import base64
import logging
import os

from app.agents.base_agent import BaseAgent
from app.agents.context import PipelineContext, GeneratedImage
from app.services.storage_service import save_image, save_thumbnail
from app.providers.model_router import get_fallback_model
from app.config import get_settings

logger = logging.getLogger(__name__)


def _load_reference_images(context: PipelineContext) -> list[str]:
    """Load reference images and brand logo as base64 strings."""
    settings = get_settings()
    images_b64 = []

    storage_root = os.path.realpath(settings.STORAGE_PATH)

    # Load uploaded reference images
    for ref_url in (context.brief.reference_urls or []):
        try:
            clean_path = ref_url.lstrip("/")
            if clean_path.startswith("storage/"):
                clean_path = clean_path[len("storage/"):]
            file_path = os.path.realpath(os.path.join(storage_root, clean_path))
            if not file_path.startswith(storage_root):
                logger.warning(f"Path traversal blocked: {ref_url}")
                continue
            if os.path.isfile(file_path):
                with open(file_path, "rb") as f:
                    img_bytes = f.read()
                images_b64.append(base64.b64encode(img_bytes).decode())
                logger.info(f"Loaded reference image: {file_path}")
            else:
                logger.warning(f"Reference image not found: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to load reference image {ref_url}: {e}")

    # Load brand logo (skip data: URLs — they're already base64)
    if context.brand and context.brand.logo_url:
        logo_url = context.brand.logo_url
        if logo_url.startswith("data:"):
            # Extract base64 from data URL
            comma_idx = logo_url.find(",")
            if comma_idx > 0:
                images_b64.append(logo_url[comma_idx + 1:])
                logger.info("Loaded brand logo from data URL")
        else:
            try:
                logo_path = logo_url.lstrip("/")
                if logo_path.startswith("storage/"):
                    logo_path = logo_path[len("storage/"):]
                file_path = os.path.realpath(os.path.join(storage_root, logo_path))
                if not file_path.startswith(storage_root):
                    logger.warning(f"Path traversal blocked for logo: {logo_url}")
                elif os.path.isfile(file_path):
                    with open(file_path, "rb") as f:
                        img_bytes = f.read()
                    images_b64.append(base64.b64encode(img_bytes).decode())
                    logger.info(f"Loaded brand logo: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to load brand logo: {e}")

    return images_b64


def _load_inclusion_images(context: PipelineContext) -> list[str]:
    """Load inclusion images as base64 strings.

    Inclusion images are assets that MUST appear in the generated image
    (e.g., product photos, person photos), unlike reference images which
    are just style inspiration.
    """
    settings = get_settings()
    images_b64 = []

    storage_root = os.path.realpath(settings.STORAGE_PATH)

    for inc_url in (context.brief.inclusion_urls or []):
        try:
            clean_path = inc_url.lstrip("/")
            if clean_path.startswith("storage/"):
                clean_path = clean_path[len("storage/"):]
            file_path = os.path.realpath(os.path.join(storage_root, clean_path))
            if not file_path.startswith(storage_root):
                logger.warning(f"Path traversal blocked for inclusion: {inc_url}")
                continue
            if os.path.isfile(file_path):
                with open(file_path, "rb") as f:
                    img_bytes = f.read()
                images_b64.append(base64.b64encode(img_bytes).decode())
                logger.info(f"Loaded inclusion image: {file_path}")
            else:
                logger.warning(f"Inclusion image not found: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to load inclusion image {inc_url}: {e}")

    return images_b64


class GeneratorAgent(BaseAgent):
    name = "generator"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        prompt = context.generation_prompt
        if not prompt:
            raise ValueError("No generation prompt in context")

        # Load reference images (uploads + brand logo)
        reference_images = _load_reference_images(context)
        if reference_images:
            context.log_decision(
                agent_name=self.name,
                decision=f"Loaded {len(reference_images)} reference image(s)",
                reasoning="Sending reference images to the model for visual context",
            )

        # Load inclusion images (assets that MUST appear in the generated image)
        inclusion_images = _load_inclusion_images(context)
        if inclusion_images:
            context.log_decision(
                agent_name=self.name,
                decision=f"Loaded {len(inclusion_images)} inclusion image(s)",
                reasoning="Sending inclusion images — these must appear prominently in the generated image",
            )

        # Combine all images for the model (reference + inclusion)
        all_images = reference_images + inclusion_images

        # Load anchor image if available (for batch visual consistency)
        if context.anchor_image_url:
            anchor_b64 = self._load_single_image(context.anchor_image_url)
            if anchor_b64:
                # Insert anchor FIRST so model sees it as primary reference
                all_images.insert(0, anchor_b64)
                context.log_decision(
                    agent_name=self.name,
                    decision="Loaded anchor image for batch consistency",
                    reasoning="First-generated image used as visual reference to maintain consistency across batch",
                )

        # Try primary model
        try:
            image_bytes = await self.client.generate_image(
                model=prompt.selected_model,
                prompt=prompt.main_prompt,
                aspect_ratio=prompt.aspect_ratio,
                image_size=prompt.image_size,
                additional_params=prompt.additional_params if prompt.additional_params else None,
                reference_images=all_images or None,
            )
        except Exception as e:
            logger.warning(f"Primary model {prompt.selected_model} failed: {e}. Trying fallback.")
            # Try fallback model
            art_type = context.creative_direction.selected_art_type if context.creative_direction else "social_post"
            fallback_model = get_fallback_model(art_type)

            context.log_decision(
                agent_name=self.name,
                decision=f"Switched to fallback model: {fallback_model}",
                reasoning=f"Primary model {prompt.selected_model} failed with: {str(e)}",
            )

            image_bytes = await self.client.generate_image(
                model=fallback_model,
                prompt=prompt.main_prompt,
                aspect_ratio=prompt.aspect_ratio,
                image_size=prompt.image_size,
                reference_images=all_images or None,
            )
            prompt.selected_model = fallback_model  # Update for tracking

        # Save image to storage (use generation_id so each generation has its own folder)
        brand_id = context.brand.id if context.brand else None
        storage_id = context.generation_id or context.brief_id
        image_url = await save_image(
            image_data=image_bytes,
            generation_id=storage_id,
            filename=f"gen_iter{context.iteration}.png",
            brand_id=brand_id,
        )

        # Save thumbnail
        thumbnail_url = await save_thumbnail(
            image_data=image_bytes,
            generation_id=storage_id,
            brand_id=brand_id,
        )

        # Add to context
        generated_image = GeneratedImage(
            image_url=image_url,
            model_used=prompt.selected_model,
            prompt_used=prompt.main_prompt,
            generation_params={
                "aspect_ratio": prompt.aspect_ratio,
                "image_size": prompt.image_size,
                "negative_prompt": prompt.negative_prompt,
                "iteration": context.iteration,
            },
        )
        context.generated_images.append(generated_image)

        return context

    def _load_single_image(self, url: str) -> str | None:
        """Load a single image from storage as base64."""
        settings = get_settings()
        clean = url.lstrip("/")
        if clean.startswith("storage/"):
            clean = clean[len("storage/"):]
        path = os.path.realpath(os.path.join(settings.STORAGE_PATH, clean))
        if not path.startswith(os.path.realpath(settings.STORAGE_PATH)):
            return None
        if not os.path.isfile(path):
            return None
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        if context.generated_images:
            last = context.generated_images[-1]
            return f"Generated image with {last.model_used}, saved to {last.image_url}"
        return "Image generated"
