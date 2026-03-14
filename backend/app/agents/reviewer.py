import asyncio
import base64
import json
import os
import re
from pathlib import Path

from app.agents.base_agent import BaseAgent
from app.agents.context import PipelineContext, QualityReview
from app.config import get_settings


SYSTEM_PROMPT = """You are an expert Art Director reviewing AI-generated images. Evaluate the image against the original brief and brand guidelines.

Score each dimension 0-100:
1. composition_score: Visual balance, hierarchy, spacing, rule of thirds
2. text_accuracy_score: Text correctness and legibility (100 if no text required)
3. brand_alignment_score: Color accuracy, tone consistency, brand rules followed
4. technical_score: Resolution quality, no artifacts, clean edges

Output JSON:
{
    "composition_score": 0-100,
    "text_accuracy_score": 0-100,
    "brand_alignment_score": 0-100,
    "technical_score": 0-100,
    "issues": [{"type": "composition|text|brand|technical", "description": "what's wrong", "severity": "critical|major|minor"}],
    "summary": "brief overall assessment"
}

Always output valid JSON only, no markdown."""


class ReviewerAgent(BaseAgent):
    name = "reviewer"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        settings = get_settings()

        if not context.generated_images:
            raise ValueError("No generated images in context to review")

        latest_image = context.generated_images[-1]

        # Read image from disk and convert to base64 (non-blocking)
        image_path = os.path.join(settings.STORAGE_PATH, latest_image.image_url.lstrip("/"))
        image_bytes = await asyncio.to_thread(lambda: Path(image_path).read_bytes())
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        # Build user prompt with brief, brand, and generation context
        user_prompt = self._build_user_prompt(context)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        # Call vision LLM (reduced max_tokens — output is ~300 tokens JSON)
        response = await self.client.chat_with_vision(
            model=settings.VISION_MODEL,
            messages=messages,
            image_base64=image_base64,
            temperature=0.3,
            max_tokens=1024,
        )

        # Strip markdown code blocks if present
        text = response.strip()
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```\s*$', '', text)
        review_data = json.loads(text)

        # Calculate weighted overall score
        composition_score = int(review_data["composition_score"])
        text_accuracy_score = int(review_data["text_accuracy_score"])
        brand_alignment_score = int(review_data["brand_alignment_score"])
        technical_score = int(review_data["technical_score"])

        overall_score = int(
            composition_score * 0.25
            + text_accuracy_score * 0.30
            + brand_alignment_score * 0.25
            + technical_score * 0.20
        )

        approved = overall_score >= settings.QUALITY_THRESHOLD

        context.review = QualityReview(
            overall_score=overall_score,
            composition_score=composition_score,
            text_accuracy_score=text_accuracy_score,
            brand_alignment_score=brand_alignment_score,
            technical_score=technical_score,
            issues=review_data.get("issues", []),
            approved=approved,
            summary=review_data.get("summary", ""),
        )

        return context

    def _build_user_prompt(self, context: PipelineContext) -> str:
        brief = context.brief
        parts = [
            "## Brief",
            f"- Art Type: {brief.art_type}",
            f"- Format: {brief.format}",
        ]

        if brief.headline:
            parts.append(f"- Headline: {brief.headline}")
        if brief.body_text:
            parts.append(f"- Body Text: {brief.body_text}")
        if brief.cta_text:
            parts.append(f"- CTA: {brief.cta_text}")
        if brief.description:
            parts.append(f"- Description: {brief.description}")

        if context.brand:
            brand = context.brand
            parts.append("\n## Brand Guidelines")
            parts.append(f"- Brand: {brand.name}")
            if brand.primary_colors:
                parts.append(f"- Primary Colors: {', '.join(brand.primary_colors)}")
            if brand.secondary_colors:
                parts.append(f"- Secondary Colors: {', '.join(brand.secondary_colors)}")
            if brand.tone_of_voice:
                parts.append(f"- Tone: {brand.tone_of_voice}")
            if brand.do_rules:
                parts.append(f"- Do: {', '.join(brand.do_rules)}")
            if brand.dont_rules:
                parts.append(f"- Don't: {', '.join(brand.dont_rules)}")

        if context.creative_direction:
            cd = context.creative_direction
            parts.append("\n## Creative Direction")
            parts.append(f"- Mood: {cd.mood}")
            parts.append(f"- Style: {cd.style}")
            parts.append(f"- Composition: {cd.composition_notes}")
            if cd.color_palette:
                parts.append(f"- Color Palette: {', '.join(cd.color_palette)}")

        if context.generation_prompt:
            parts.append("\n## Prompt Used")
            parts.append(f"- Prompt: {context.generation_prompt.main_prompt}")

        parts.append("\nEvaluate the attached image against the brief and brand guidelines above.")

        return "\n".join(parts)

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        review = context.review
        if review:
            status = "APPROVED" if review.approved else "REJECTED"
            return (
                f"Review {status}: overall={review.overall_score}, "
                f"composition={review.composition_score}, text={review.text_accuracy_score}, "
                f"brand={review.brand_alignment_score}, technical={review.technical_score}"
            )
        return "Review completed"
