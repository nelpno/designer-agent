import json
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

        user_prompt = self._build_user_prompt(context, selected_model)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # Call LLM to build the optimized prompt
        response = await self.client.chat(
            model=settings.LLM_MODEL,
            messages=messages,
            temperature=0.6,
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

Gemini models respond best to JSON-structured prompts. Your job is to produce the most effective structured prompt.

Output a JSON object with these fields:
{
    "main_prompt": "<the JSON-structured image generation prompt as a string — see format below>",
    "negative_prompt": "what to avoid, comma-separated"
}

The main_prompt value MUST be a JSON-structured string following this schema:
{
    "subject": "detailed description of the main subject",
    "composition": "framing, angle, element positions, visual hierarchy",
    "style": "specific artistic or photographic style",
    "lighting": "type, direction, quality of light",
    "color_palette": ["#hex1", "#hex2", "#hex3"],
    "mood": "emotional tone",
    "background": "background description",
    "text_overlay": {
        "headline": "exact text in quotes",
        "body": "exact text in quotes",
        "cta": "exact text in quotes",
        "style": "font weight, color, size, position"
    },
    "brand_elements": "logo placement, brand visual elements",
    "technical": "resolution, quality descriptors"
}

CRITICAL RULES for Gemini:
- ALL text that must appear in the image MUST be in double quotes inside text_overlay
- Use HEX color codes (e.g., #FF5733), not color names. Associate colors with specific elements.
- Be extremely specific about composition: "top-third", "bottom-right corner", "centered with 20% padding"
- Use photographic/cinematographic language: "85mm f/1.4 lens", "three-point softbox lighting"
- The main_prompt should be the JSON object serialized as a string
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

    def _build_user_prompt(self, context: PipelineContext, selected_model: str) -> str:
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
            if brand.logo_url:
                parts.append(f"- Logo: The brand has a logo. Include it naturally in the design (typically bottom corner or as a watermark).")

        parts.append(f"\nProduce the best possible prompt for {selected_model}, following the format rules in your system instructions.")

        return "\n".join(parts)

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        gp = context.generation_prompt
        if gp:
            return f"Model: {gp.selected_model}, size: {gp.image_size}, ratio: {gp.aspect_ratio}"
        return "Generation prompt created"
