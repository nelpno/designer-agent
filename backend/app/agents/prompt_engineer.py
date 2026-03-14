import json

from app.agents.base_agent import BaseAgent
from app.agents.context import PipelineContext, GenerationPrompt
from app.config import get_settings
from app.prompts.base_templates import PROMPT_TEMPLATES, DEFAULT_TEMPLATE, QUALITY_MODIFIERS, DEFAULT_NEGATIVE
from app.providers.model_router import select_model, get_format_config


class PromptEngineerAgent(BaseAgent):
    name = "prompt_engineer"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        settings = get_settings()

        creative_direction = context.creative_direction
        brief = context.brief
        brand = context.brand

        art_type = creative_direction.selected_art_type
        has_significant_text = creative_direction.has_significant_text

        # Select model and format config
        selected_model = select_model(art_type, has_significant_text)
        format_config = get_format_config(
            brief.format,
            custom_width=brief.custom_width,
            custom_height=brief.custom_height,
        )

        # Build base template
        base_template_str = self._build_base_template(art_type, context)

        # Build LLM system prompt
        system_prompt = """You are a Prompt Engineer specializing in AI image generation. Your job is to take a creative brief and produce the most effective prompt for generating the image.

Output JSON with exactly these fields:
{
    "main_prompt": "the optimized image generation prompt, detailed and specific",
    "negative_prompt": "what to avoid in the image, comma-separated"
}

Guidelines:
- main_prompt should be rich with visual details: lighting, composition, style, mood, colors
- Use concrete visual descriptors, not abstract concepts
- For text elements in the image, be very explicit about placement and style
- negative_prompt should list specific visual problems to avoid
- Output valid JSON only, no markdown."""

        user_prompt = self._build_user_prompt(context, base_template_str)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # Call LLM to enhance the prompt
        response = await self.client.chat(
            model=settings.LLM_MODEL,
            messages=messages,
            temperature=0.6,
            response_format={"type": "json_object"},
        )

        prompt_data = json.loads(response)

        context.generation_prompt = GenerationPrompt(
            main_prompt=prompt_data["main_prompt"],
            negative_prompt=prompt_data.get("negative_prompt", DEFAULT_NEGATIVE),
            selected_model=selected_model,
            aspect_ratio=format_config["aspect_ratio"],
            image_size=format_config["image_size"],
        )

        return context

    def _build_base_template(self, art_type: str, context: PipelineContext) -> str:
        """Fill in the base template with context data and return the resulting string."""
        template_def = PROMPT_TEMPLATES.get(art_type, DEFAULT_TEMPLATE)
        template = template_def["template"]
        negative = template_def["negative"]

        brief = context.brief
        creative_direction = context.creative_direction
        brand = context.brand

        brand_name = brand.name if brand else (brief.description or "the brand")
        color_guidance = self._build_color_guidance(creative_direction, brand)

        placeholders = {
            "brand_name": brand_name,
            "style": creative_direction.style,
            "description": brief.description or "",
            "color_guidance": color_guidance,
            "platform": brief.platform or "digital",
            "headline": brief.headline or "",
            "cta_text": brief.cta_text or "",
            "composition": creative_direction.composition_notes,
            "QUALITY_MODIFIERS": QUALITY_MODIFIERS,
            "DEFAULT_NEGATIVE": DEFAULT_NEGATIVE,
        }

        # Safe format: replace only known placeholders, leave unknown ones
        for key, value in placeholders.items():
            template = template.replace("{" + key + "}", value)
            negative = negative.replace("{" + key + "}", value)

        return f"BASE TEMPLATE (main): {template}\nBASE TEMPLATE (negative): {negative}"

    def _build_color_guidance(self, creative_direction, brand) -> str:
        """Build a human-readable color guidance string."""
        colors = []

        if creative_direction.color_palette:
            colors.extend(creative_direction.color_palette)
        elif brand:
            if brand.primary_colors:
                colors.extend(brand.primary_colors)
            if brand.secondary_colors:
                colors.extend(brand.secondary_colors)

        if colors:
            return f"color palette: {', '.join(colors)}"
        return "harmonious color palette"

    def _build_user_prompt(self, context: PipelineContext, base_template: str) -> str:
        brief = context.brief
        creative_direction = context.creative_direction
        brand = context.brand

        parts = [
            "## Creative Brief",
            f"- Art Type: {brief.art_type} (refined to: {creative_direction.selected_art_type})",
            f"- Format: {brief.format}",
        ]

        if brief.platform:
            parts.append(f"- Platform: {brief.platform}")
        if brief.headline:
            parts.append(f"- Headline: {brief.headline}")
        if brief.body_text:
            parts.append(f"- Body Text: {brief.body_text}")
        if brief.cta_text:
            parts.append(f"- CTA: {brief.cta_text}")
        if brief.description:
            parts.append(f"- Description: {brief.description}")

        parts.append("\n## Creative Direction")
        parts.append(f"- Mood: {creative_direction.mood}")
        parts.append(f"- Style: {creative_direction.style}")
        parts.append(f"- Composition: {creative_direction.composition_notes}")
        parts.append(f"- Color Palette: {', '.join(creative_direction.color_palette)}")
        parts.append(f"- Has Significant Text: {creative_direction.has_significant_text}")

        if creative_direction.typography_direction:
            parts.append(f"- Typography: {creative_direction.typography_direction}")
        if creative_direction.reference_analysis:
            parts.append(f"- Reference Analysis: {creative_direction.reference_analysis}")

        if brand:
            parts.append("\n## Brand Guidelines")
            parts.append(f"- Brand Name: {brand.name}")
            if brand.tone_of_voice:
                parts.append(f"- Tone: {brand.tone_of_voice}")
            if brand.do_rules:
                parts.append(f"- Do: {', '.join(brand.do_rules)}")
            if brand.dont_rules:
                parts.append(f"- Don't: {', '.join(brand.dont_rules)}")

        parts.append(f"\n## Base Template\n{base_template}")
        parts.append("\nUsing the above brief, creative direction, and base template as starting points, produce an enhanced and optimized image generation prompt.")

        return "\n".join(parts)

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        gp = context.generation_prompt
        if gp:
            return f"Model: {gp.selected_model}, size: {gp.image_size}, ratio: {gp.aspect_ratio}"
        return "Generation prompt created"
