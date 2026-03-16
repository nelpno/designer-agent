import json
import re

from app.agents.base_agent import BaseAgent
from app.agents.context import PipelineContext, CreativeDirection
from app.config import get_settings


COMPOSITION_PROMPT_ADDENDUM = """

ADDITIONAL OUTPUT — Programmatic Composition Layout:
This art type uses PROGRAMMATIC text/logo composition. The AI model will generate a clean background image, and text + logo will be overlaid programmatically afterward.

You MUST include an additional field "composition_layout" in your JSON output:
{
    "composition_layout": {
        "use_compositor": true,
        "text_zones": [
            {
                "field": "headline",
                "region": "top",
                "alignment": "center",
                "size_hint": "large",
                "style": "bold",
                "color_hint": "light"
            },
            {
                "field": "body_text",
                "region": "center",
                "alignment": "left",
                "size_hint": "medium",
                "style": "regular",
                "color_hint": "light"
            },
            {
                "field": "cta_text",
                "region": "bottom",
                "alignment": "center",
                "size_hint": "medium",
                "style": "bold",
                "color_hint": "light"
            }
        ],
        "logo_placement": {
            "position": "bottom-right",
            "size": "small",
            "opacity": 1.0
        },
        "reserved_areas": [
            "top 25% for headline text",
            "bottom 15% for CTA and logo"
        ]
    }
}

Rules for composition_layout fields:
- use_compositor: always true when this addendum is active
- text_zones: one entry per text field present in the brief (headline, body_text, cta_text, or slide_headline/slide_body for carousels)
  - field: must match the brief field name exactly
  - region: "top" | "center" | "bottom" — vertical zone where text should be placed
  - alignment: "left" | "center" | "right" — horizontal text alignment
  - size_hint: "large" (headlines, CTAs) | "medium" (body text) | "small" (fine print, disclaimers)
  - style: "bold" | "semibold" | "medium" | "regular" | "light" — font weight
  - color_hint: "light" (for dark backgrounds) | "dark" (for light backgrounds) | "auto" (let compositor decide)
- logo_placement: where the brand logo should go (null if no brand logo)
  - position: "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right"
  - size: "small" | "medium" | "large"
  - opacity: 0.0 to 1.0 (default 1.0)
- reserved_areas: list of natural language descriptions of areas the background image should keep clean/simple for text overlay (e.g., "top 25% for headline text")

Think about visual hierarchy: headline gets more space, CTA should be prominent, body text fits in between.
Consider the background: if dark mood, use color_hint "light" for text; if bright/light mood, use "dark"."""


class CreativeDirectorAgent(BaseAgent):
    name = "creative_director"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        settings = get_settings()

        # Build the system prompt
        system_prompt = """You are a Creative Director for a design agency. Your job is to interpret client briefs and define creative direction for art generation.

IMPORTANT — Description Enhancement:
If the client's description is vague, short, or lacks visual detail, you MUST enrich it significantly.
Transform weak descriptions into rich creative briefs with specific visual elements, composition ideas, color treatments, and mood.
Example: "promoção de verão" → "Vibrant summer promotion scene with tropical elements, beach-inspired color palette of coral and turquoise, dynamic diagonal composition with bold overlapping shapes, sunlit atmosphere with warm golden highlights"

You must output a JSON object with these exact fields:
{
    "mood": "specific mood/feeling (e.g., 'energetic and aspirational with a sense of urgency')",
    "style": "precise artistic style (e.g., 'modern corporate with geometric accents' not just 'professional')",
    "composition_notes": "detailed layout instructions — element positions, visual hierarchy, focal points",
    "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
    "typography_direction": "specific font style, weight, case (e.g., 'bold condensed uppercase sans-serif, high contrast with background')",
    "reference_analysis": "analysis of any reference materials provided",
    "selected_art_type": "refined art type based on the brief",
    "has_significant_text": true/false,
    "enhanced_description": "your enriched, detailed version of the client's description — always more specific than the original"
}

Guidelines:
- color_palette must always use HEX codes, not color names
- If brand guidelines provide colors, incorporate them into the palette
- has_significant_text = true whenever headline, body_text, or CTA are provided
- Be bold and specific, never generic. "Clean and modern" is too vague. "Swiss-style grid layout with 60% negative space and accent color used only on CTA" is specific.
- Output valid JSON only, no markdown."""

        # Check if this art type uses programmatic composition
        from app.config.art_type_config import get_art_type_config
        art_type_config = get_art_type_config(context.brief.art_type)
        use_composition = art_type_config and art_type_config.get("programmaticComposition", False)
        if use_composition:
            system_prompt += COMPOSITION_PROMPT_ADDENDUM

        # Build the user prompt with brief details
        user_prompt = self._build_user_prompt(context)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        # Use best model for creative direction — most impactful creative decision in pipeline
        response = await self.client.chat(
            model=settings.LLM_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
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

        # Parse composition_layout if present (programmatic composition)
        composition_layout = None
        if use_composition and "composition_layout" in direction_data:
            from dataclasses import fields as dc_fields
            from app.agents.context import CompositionLayout, TextZone, LogoPlacement
            try:
                cl = direction_data["composition_layout"]
                if isinstance(cl, dict):
                    tz_fields = {f.name for f in dc_fields(TextZone)}
                    lp_fields = {f.name for f in dc_fields(LogoPlacement)}
                    text_zones = [TextZone(**{k: v for k, v in tz.items() if k in tz_fields}) for tz in cl.get("text_zones", []) if isinstance(tz, dict)]
                    lp = cl.get("logo_placement")
                    logo_placement = LogoPlacement(**{k: v for k, v in lp.items() if k in lp_fields}) if isinstance(lp, dict) else None
                    composition_layout = CompositionLayout(
                        use_compositor=cl.get("use_compositor", False),
                        text_zones=text_zones,
                        logo_placement=logo_placement,
                        reserved_areas=cl.get("reserved_areas", []),
                    )
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to parse composition_layout from CD: {e}")
                composition_layout = None
        context.creative_direction.composition_layout = composition_layout

        # Store enhanced description for downstream agents
        if direction_data.get("enhanced_description"):
            context.enhanced_description = direction_data["enhanced_description"]

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
            if brand.logo_url:
                parts.append(f"- Logo: brand has a logo that should be referenced in the design")

        # Carousel slides context
        if brief.slides:
            parts.append(f"\n## Carousel Content — {len(brief.slides)} Slides")
            parts.append("- This is a carousel post. Consider the narrative arc across slides.")
            parts.append("- Define a visual style that works for ALL slides as a cohesive set.")
            parts.append("- Typography and layout must accommodate varying text lengths across slides.")
            for i, slide in enumerate(brief.slides, 1):
                headline = slide.get("headline", "")
                body = slide.get("body_text", "")
                parts.append(f"- Slide {i}: \"{headline}\" — {body}")

        return "\n".join(parts)

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        cd = context.creative_direction
        if cd:
            return f"Defined direction: {cd.style} style, mood: {cd.mood}, text: {cd.has_significant_text}"
        return "Creative direction defined"
