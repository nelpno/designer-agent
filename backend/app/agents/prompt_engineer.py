import base64
import json
import os
import re

from app.agents.base_agent import BaseAgent
from app.agents.context import PipelineContext, GenerationPrompt
from app.config import get_settings
from app.prompts.base_templates import PROMPT_TEMPLATES, DEFAULT_TEMPLATE, QUALITY_MODIFIERS, DEFAULT_NEGATIVE
from app.providers.model_router import select_model, get_format_config


def _is_gemini_model(model: str) -> bool:
    return model.startswith("google/")


def _is_flux_model(model: str) -> bool:
    return model.startswith("black-forest-labs/")


class PromptEngineerAgent(BaseAgent):
    name = "prompt_engineer"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        settings = get_settings()

        creative_direction = context.creative_direction
        brief = context.brief
        brand = context.brand

        art_type = creative_direction.selected_art_type
        has_significant_text = creative_direction.has_significant_text

        # DISABLED: compositor produces poor results with current models
        use_compositor = False

        # Select model and format config
        selected_model = select_model(art_type, has_significant_text)
        format_config = get_format_config(
            brief.format,
            custom_width=brief.custom_width,
            custom_height=brief.custom_height,
        )

        # Build model-specific system prompt
        if _is_gemini_model(selected_model):
            system_prompt = self._gemini_system_prompt()
        elif _is_flux_model(selected_model):
            system_prompt = self._flux_system_prompt()
        else:
            system_prompt = self._generic_system_prompt()

        # Build reserved zone instructions for compositor
        reserved_zone_instructions = ""
        if use_compositor:
            zone_lines = [
                "\n\nCRITICAL COMPOSITION RULES:",
                "- DO NOT include any text, words, letters, numbers, or typography in the image",
                "- The image must be a pure visual/background — all text will be added programmatically after generation",
            ]
            for area in composition_layout.reserved_areas:
                zone_lines.append(f"- Leave space: {area}")
            if composition_layout.logo_placement:
                zone_lines.append(f"- Reserve the {composition_layout.logo_placement.position} area for a small logo placement")
            reserved_zone_instructions = "\n".join(zone_lines)

        user_prompt = self._build_user_prompt(context, selected_model, use_compositor=use_compositor)
        user_prompt += reserved_zone_instructions

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # Load first reference image for vision analysis (PE sees what user uploaded)
        ref_image_b64 = self._load_first_reference(context)

        # Call LLM with vision if reference available, otherwise text-only
        if ref_image_b64:
            response = await self.client.chat_with_vision(
                model=settings.LLM_MODEL,
                messages=messages,
                image_base64=ref_image_b64,
                temperature=0.6,
                max_tokens=1024,
            )
        else:
            response = await self.client.chat(
                model=settings.LLM_MODEL,
                messages=messages,
                temperature=0.6,
                max_tokens=1024,
            )

        # Strip markdown code blocks if present
        text = response.strip()
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```\s*$', '', text)
        prompt_data = json.loads(text)

        # FLUX models don't use negative prompts
        negative = None if _is_flux_model(selected_model) else prompt_data.get("negative_prompt", DEFAULT_NEGATIVE)

        context.generation_prompt = GenerationPrompt(
            main_prompt=prompt_data["main_prompt"],
            negative_prompt=negative,
            selected_model=selected_model,
            aspect_ratio=format_config["aspect_ratio"],
            image_size=format_config["image_size"],
        )

        return context

    def _gemini_system_prompt(self) -> str:
        return """You are a Prompt Engineer specializing in Google Gemini image generation.

Your job is to produce a rich, descriptive image generation prompt.

Output a JSON object with these fields:
{
    "main_prompt": "the detailed image generation prompt as natural language",
    "negative_prompt": "what to avoid, comma-separated"
}

CRITICAL RULES for the main_prompt:
- Write a rich natural language description of the FINAL IMAGE the viewer should see
- ALL text that must appear in the image MUST be in double quotes: "Auditoria Grátis"
- Use HEX color codes associated to elements: "a #FF5733 call-to-action button"
- Describe composition naturally: "headline at the top third, CTA button centered below, logo in the bottom-right corner"
- Use photographic language: "clean studio lighting", "soft gradient background"
- NEVER include technical measurements (px, %, rem, pt) — these get rendered as visible text
- NEVER include wireframe annotations, dimension markers, or spacing specifications
- NEVER describe the image as a "design specification" or "layout blueprint"
- The prompt must describe what the FINISHED design looks like, not how to build it
- Output valid JSON only, no markdown."""

    def _flux_system_prompt(self) -> str:
        return """You are a Prompt Engineer specializing in FLUX.2 image generation by Black Forest Labs.

FLUX.2 works best with rich natural language prompts. It does NOT support negative prompts.

Output a JSON object with these fields:
{
    "main_prompt": "the natural language image generation prompt"
}

CRITICAL RULES for FLUX.2:
- Write in flowing natural language, NOT keywords or tag lists
- Word order matters: put the MOST IMPORTANT element first
- Optimal length: 30-80 words for most images, up to 120 for complex scenes
- For photorealism: specify camera model and lens (e.g., "Shot on Fujifilm X-T5 with 35mm f/1.4")
- Use HEX color codes associated with specific objects: "The car is #FF0000" not "use red"
- FLUX has NO negative prompts — only describe what you WANT, never what to avoid
- Describe lighting cinematically: "golden hour sunlight casting long shadows" not just "good lighting"
- For text in images: FLUX struggles with text rendering. Describe text elements but know they may not be perfect.
- DO NOT include a negative_prompt field
- Output valid JSON only, no markdown."""

    def _generic_system_prompt(self) -> str:
        return """You are a Prompt Engineer specializing in AI image generation.

Output a JSON object with these fields:
{
    "main_prompt": "the optimized image generation prompt, detailed and specific",
    "negative_prompt": "what to avoid in the image, comma-separated"
}

Guidelines:
- main_prompt should be rich with visual details: lighting, composition, style, mood, colors
- Use concrete visual descriptors, not abstract concepts
- For text elements, be explicit about placement and style
- Use HEX color codes, not color names
- Output valid JSON only, no markdown."""

    def _build_user_prompt(self, context: PipelineContext, selected_model: str, use_compositor: bool = False) -> str:
        brief = context.brief
        creative_direction = context.creative_direction
        brand = context.brand

        # Use enhanced description if available
        description = context.enhanced_description or brief.description or ""

        parts = [
            f"## Target Model: {selected_model}",
            "",
            "## Creative Brief",
            f"- Art Type: {brief.art_type} (refined to: {creative_direction.selected_art_type})",
            f"- Format: {brief.format}",
        ]

        if brief.platform:
            parts.append(f"- Platform: {brief.platform}")
        # When compositor is active, don't tell the model to render text
        if not use_compositor:
            if brief.headline:
                parts.append(f'- Headline (MUST appear in image exactly as): "{brief.headline}"')
            if brief.body_text:
                parts.append(f'- Body Text (MUST appear in image exactly as): "{brief.body_text}"')
            if brief.cta_text:
                parts.append(f'- CTA (MUST appear in image exactly as): "{brief.cta_text}"')
        if description:
            parts.append(f"- Description: {description}")

        parts.append("\n## Creative Direction")
        parts.append(f"- Mood: {creative_direction.mood}")
        parts.append(f"- Style: {creative_direction.style}")
        parts.append(f"- Composition: {creative_direction.composition_notes}")
        parts.append(f"- Color Palette (use these HEX codes): {', '.join(creative_direction.color_palette)}")
        parts.append(f"- Has Significant Text: {creative_direction.has_significant_text}")

        if creative_direction.typography_direction:
            parts.append(f"- Typography: {creative_direction.typography_direction}")
        if creative_direction.reference_analysis:
            parts.append(f"- Reference Analysis: {creative_direction.reference_analysis}")

        if brand:
            parts.append("\n## Brand Guidelines")
            parts.append(f"- Brand Name: {brand.name}")
            if brand.primary_colors:
                parts.append(f"- Primary Colors (HEX): {', '.join(brand.primary_colors)}")
            if brand.secondary_colors:
                parts.append(f"- Secondary Colors (HEX): {', '.join(brand.secondary_colors)}")
            if brand.tone_of_voice:
                parts.append(f"- Tone: {brand.tone_of_voice}")
            if brand.do_rules:
                parts.append(f"- Do: {', '.join(brand.do_rules)}")
            if brand.dont_rules:
                parts.append(f"- Don't: {', '.join(brand.dont_rules)}")
            # Only tell model to include logo if compositor is NOT handling it
            cl = getattr(creative_direction, "composition_layout", None)
            if brand.logo_url and (not use_compositor or not cl or not cl.logo_placement):
                parts.append(f"- Logo: The brand has a logo. Include it naturally in the design (typically bottom corner or as a watermark).")

        # Reference images info
        has_refs = bool(brief.reference_urls)
        has_logo = bool(brand and brand.logo_url)
        if has_refs or has_logo:
            parts.append("\n## Reference Images (will be sent to the model)")
            if has_refs:
                parts.append(f"- {len(brief.reference_urls)} reference image(s) uploaded by the user will be sent alongside your prompt")
                parts.append("- You are SEEING the first reference image right now. ANALYZE it carefully:")
                parts.append("  - Describe its exact layout: where elements are positioned, proportions, visual hierarchy")
                parts.append("  - Note the color palette, lighting style, and mood")
                parts.append("  - Identify the composition pattern (centered, rule-of-thirds, split, etc.)")
                parts.append("  - Your prompt MUST reproduce this exact layout and style")
                parts.append("- Reference images will also be sent to the image model directly")
            if has_logo:
                parts.append("- The brand logo will be sent as a reference image")
                parts.append("- Your prompt should instruct the model to incorporate the logo naturally in the design")

        # Inclusion images — assets that MUST appear in the generated image
        has_inclusions = bool(brief.inclusion_urls)
        if has_inclusions:
            parts.append(f"\n## Inclusion Images — MUST APPEAR ({len(brief.inclusion_urls)} image(s))")
            parts.append("- The following person/product images MUST appear prominently in the generated image")
            parts.append("- These are NOT just style references — the actual content of these images must be visible in the final design")
            parts.append("- Your prompt MUST instruct the model to incorporate these subjects faithfully and prominently")

        # Carousel / slides context
        if context.current_slide_index is not None and brief.slides:
            # Per-slide generation mode: only use this slide's text
            slide_idx = context.current_slide_index
            slide_num = slide_idx + 1
            total = context.total_slides or len(brief.slides)
            slide = brief.slides[slide_idx] if slide_idx < len(brief.slides) else {}
            slide_headline = slide.get("headline", "")
            slide_body = slide.get("body_text", "")

            parts.append(f"\n## Carousel Slide {slide_num} of {total}")
            parts.append(f"- This is slide {slide_num} of {total} in a carousel post")

            # Use shared visual template if available (ensures all slides look identical)
            carousel_template = None
            if context.shared_creative_direction:
                carousel_template = context.shared_creative_direction.get("carousel_visual_template")

            if carousel_template:
                parts.append("\n## MANDATORY Visual Template (follow EXACTLY for every slide)")
                parts.append("The following visual template was designed for this carousel. Your prompt MUST reproduce this EXACT layout, background, typography, and decoration style. Do NOT deviate.")
                parts.append(carousel_template)
                parts.append("\n- Only the headline text, body text, and specific imagery content should change between slides. ALL other visual elements (background, layout, frame, decorations, typography style, logo position) must remain IDENTICAL.")
            else:
                parts.append("- Maintain visual coherence with other slides: SAME background treatment, layout grid, color palette, and typography style")
                parts.append("- Each slide should feel like part of a unified set while having its own unique content")

            if not use_compositor:
                if slide_headline:
                    parts.append(f'- Headline (MUST appear in image exactly as): "{slide_headline}"')
                if slide_body:
                    parts.append(f'- Body Text (MUST appear in image exactly as): "{slide_body}"')
        elif brief.slides:
            # Legacy mode: all slides in one generation
            parts.append(f"\n## Carousel — {len(brief.slides)} Slides")
            parts.append("- This is a carousel post. Each slide must share the SAME visual style, color palette, and typography")
            parts.append("- Maintain visual coherence: consistent background treatment, layout grid, and accent colors across all slides")
            for i, slide in enumerate(brief.slides, 1):
                slide_headline = slide.get("headline", "")
                slide_body = slide.get("body_text", "")
                parts.append(f"- Slide {i}:")
                if slide_headline:
                    parts.append(f'  - Headline: "{slide_headline}"')
                if slide_body:
                    parts.append(f'  - Body: "{slide_body}"')

        # Multi-format batch visual template (non-carousel)
        if context.current_slide_index is None and context.shared_creative_direction:
            batch_template = context.shared_creative_direction.get("batch_visual_template")
            if batch_template:
                parts.append("\n## MANDATORY Visual Style (follow EXACTLY across all format variations)")
                parts.append("The following visual style was designed for this batch. Your prompt MUST use the EXACT same colors, imagery style, decorations, and typography described below. Adapt the LAYOUT to fit the aspect ratio, but keep the visual identity identical.")
                parts.append(batch_template)

        # Anchor image instruction (first-image-as-reference for batch consistency)
        if context.anchor_image_url:
            parts.append("\n## CRITICAL: Visual Style Anchor")
            parts.append("- An anchor image from this batch is sent as the FIRST reference image.")
            parts.append("- You MUST match its EXACT visual style: same background, color treatment, decoration style, typography style, frame/border treatment.")
            parts.append("- Only the specific content (text, subject) should change. All other visual elements must be identical.")

        parts.append(f"\nProduce the best possible prompt for {selected_model}, following the format rules in your system instructions.")

        return "\n".join(parts)

    def _load_first_reference(self, context: PipelineContext) -> str | None:
        """Load the first reference image as base64 for vision analysis."""
        refs = context.brief.reference_urls or []
        if not refs:
            return None
        settings = get_settings()
        storage_root = os.path.realpath(settings.STORAGE_PATH)
        try:
            clean = refs[0].lstrip("/")
            if clean.startswith("storage/"):
                clean = clean[len("storage/"):]
            path = os.path.realpath(os.path.join(storage_root, clean))
            if not path.startswith(storage_root) or not os.path.isfile(path):
                return None
            with open(path, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
        except Exception:
            return None

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        gp = context.generation_prompt
        if gp:
            return f"Model: {gp.selected_model}, size: {gp.image_size}, ratio: {gp.aspect_ratio}"
        return "Generation prompt created"
