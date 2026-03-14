import json
import re

from app.agents.base_agent import BaseAgent
from app.agents.context import PipelineContext, CreativeDirection
from app.config import get_settings


class CreativeDirectorAgent(BaseAgent):
    name = "creative_director"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        settings = get_settings()

        # Build the system prompt
        system_prompt = """You are a Creative Director for a design agency. Your job is to interpret client briefs and define creative direction for art generation.

You must output a JSON object with these exact fields:
{
    "mood": "description of the overall mood/feeling",
    "style": "artistic style (e.g., minimalist, bold, playful, corporate, photorealistic)",
    "composition_notes": "how elements should be arranged",
    "color_palette": ["#hex1", "#hex2", "#hex3"],
    "typography_direction": "font style recommendations if text is involved",
    "reference_analysis": "analysis of any reference materials provided",
    "selected_art_type": "refined art type based on the brief",
    "has_significant_text": true/false  // whether the final image needs readable text
}

Consider the brand guidelines if provided. Always output valid JSON only, no markdown."""

        # Build the user prompt with brief details
        user_prompt = self._build_user_prompt(context)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # Call LLM via OpenRouter
        response = await self.client.chat(
            model=settings.LLM_MODEL,
            messages=messages,
            temperature=0.7,
        )

        # Parse response — strip markdown code blocks if present
        text = response.strip()
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```\s*$', '', text)
        direction_data = json.loads(text)

        context.creative_direction = CreativeDirection(
            mood=direction_data["mood"],
            style=direction_data["style"],
            composition_notes=direction_data["composition_notes"],
            color_palette=direction_data.get("color_palette", []),
            typography_direction=direction_data.get("typography_direction"),
            reference_analysis=direction_data.get("reference_analysis"),
            selected_art_type=direction_data["selected_art_type"],
            has_significant_text=direction_data.get("has_significant_text", False),
        )

        return context

    def _build_user_prompt(self, context: PipelineContext) -> str:
        brief = context.brief
        parts = [
            "## Brief",
            f"- Art Type: {brief.art_type}",
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
        if brief.reference_urls:
            parts.append(f"- References: {', '.join(brief.reference_urls)}")

        if context.brand:
            brand = context.brand
            parts.append("\n## Brand Guidelines")
            parts.append(f"- Brand: {brand.name}")
            if brand.primary_colors:
                parts.append(f"- Primary Colors: {', '.join(brand.primary_colors)}")
            if brand.secondary_colors:
                parts.append(f"- Secondary Colors: {', '.join(brand.secondary_colors)}")
            if brand.fonts:
                parts.append(f"- Fonts: {json.dumps(brand.fonts)}")
            if brand.tone_of_voice:
                parts.append(f"- Tone: {brand.tone_of_voice}")
            if brand.do_rules:
                parts.append(f"- Do: {', '.join(brand.do_rules)}")
            if brand.dont_rules:
                parts.append(f"- Don't: {', '.join(brand.dont_rules)}")

        return "\n".join(parts)

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        cd = context.creative_direction
        if cd:
            return f"Defined direction: {cd.style} style, mood: {cd.mood}, text: {cd.has_significant_text}"
        return "Creative direction defined"
