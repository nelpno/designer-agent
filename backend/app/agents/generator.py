import logging
from app.agents.base_agent import BaseAgent
from app.agents.context import PipelineContext, GeneratedImage
from app.services.storage_service import save_image, save_thumbnail
from app.providers.model_router import get_fallback_model

logger = logging.getLogger(__name__)


class GeneratorAgent(BaseAgent):
    name = "generator"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        prompt = context.generation_prompt
        if not prompt:
            raise ValueError("No generation prompt in context")

        # Try primary model
        try:
            image_bytes = await self.client.generate_image(
                model=prompt.selected_model,
                prompt=prompt.main_prompt,
                aspect_ratio=prompt.aspect_ratio,
                image_size=prompt.image_size,
                additional_params=prompt.additional_params if prompt.additional_params else None,
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

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        if context.generated_images:
            last = context.generated_images[-1]
            return f"Generated image with {last.model_used}, saved to {last.image_url}"
        return "Image generated"
