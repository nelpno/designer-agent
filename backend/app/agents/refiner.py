import json
import re

from app.agents.base_agent import BaseAgent
from app.agents.context import PipelineContext, RefinementStep
from app.config import get_settings
from app.providers.model_router import select_model, get_fallback_model


SYSTEM_PROMPT = """You are a Prompt Refinement Specialist. Given an image that didn't pass quality review, analyze the issues and create an improved prompt.

You receive:
- The original prompt that was used
- The review issues found (including hard_reject if image has visual defects)
- The creative direction

Common AI image generation problems and how to fix them:
- **Artifacts/distortion at edges**: Add "complete composition, all elements fully visible within frame, no cropping"
- **Deformed faces/hands**: Simplify the human elements, use "professional portrait photography" style
- **Cut-off text**: Ensure text placement is well within the safe area, add "centered text layout"
- **Blurry areas**: Add "sharp focus, high detail, crisp edges"
- **Inconsistent elements**: Simplify the composition, reduce number of elements

When hard_reject is true, the image has SERIOUS visual defects. Be aggressive with prompt changes:
- Simplify composition significantly
- Add explicit quality instructions
- Consider model switch if text rendering failed

Output JSON:
{
    "strategy": "re_prompt|model_switch|parameter_adjust",
    "improved_prompt": "the new, improved image generation prompt",
    "improved_negative_prompt": "updated negative prompt",
    "reasoning": "why these changes will fix the issues",
    "suggest_model_switch": true/false,
    "suggested_model_type": "text|photo|fast|flex"
}

Note: suggested_model_type is only required when suggest_model_switch is true.
Always output valid JSON only, no markdown."""


class RefinerAgent(BaseAgent):
    name = "refiner"

    async def execute(self, context: PipelineContext) -> PipelineContext:
        settings = get_settings()

        if not context.review:
            raise ValueError("No quality review in context to refine against")

        if not context.generation_prompt:
            raise ValueError("No generation prompt in context to refine")

        user_prompt = self._build_user_prompt(context)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        response = await self.client.chat(
            model=settings.LLM_MODEL,
            messages=messages,
            temperature=0.7,
        )

        # Strip markdown code blocks if present
        text = response.strip()
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```\s*$', '', text)
        refinement_data = json.loads(text)

        strategy = refinement_data["strategy"]
        improved_prompt = refinement_data["improved_prompt"]
        improved_negative_prompt = refinement_data.get("improved_negative_prompt")
        reasoning = refinement_data.get("reasoning", "")
        suggest_model_switch = refinement_data.get("suggest_model_switch", False)
        suggested_model_type = refinement_data.get("suggested_model_type")

        # Update the generation prompt with improved values
        context.generation_prompt.main_prompt = improved_prompt
        if improved_negative_prompt:
            context.generation_prompt.negative_prompt = improved_negative_prompt

        # Handle model switch if suggested
        new_model = None
        if suggest_model_switch and suggested_model_type:
            new_model = self._resolve_model(suggested_model_type, context)
            if new_model:
                context.generation_prompt.selected_model = new_model

        # Record this refinement step in history
        iteration = context.iteration + 1
        context.refinement_history.append(RefinementStep(
            iteration=iteration,
            strategy=strategy,
            changes_made=reasoning,
            new_prompt=improved_prompt,
            new_model=new_model,
        ))

        return context

    def _resolve_model(self, model_type: str, context: PipelineContext) -> str | None:
        """Map a suggested model type string to an actual model ID."""
        settings = get_settings()

        model_map = {
            "text": settings.IMAGE_MODEL_TEXT,
            "photo": settings.IMAGE_MODEL_PHOTO,
            "fast": settings.IMAGE_MODEL_FAST,
            "flex": settings.IMAGE_MODEL_FLEX,
        }

        return model_map.get(model_type)

    def _build_user_prompt(self, context: PipelineContext) -> str:
        review = context.review
        generation_prompt = context.generation_prompt
        brief = context.brief

        parts = [
            "## Original Prompt",
            f"- Main Prompt: {generation_prompt.main_prompt}",
        ]

        if generation_prompt.negative_prompt:
            parts.append(f"- Negative Prompt: {generation_prompt.negative_prompt}")

        parts.append(f"- Model Used: {generation_prompt.selected_model}")

        parts.append("\n## Review Results")
        parts.append(f"- Overall Score: {review.overall_score}/100")
        parts.append(f"- Composition Score: {review.composition_score}/100")
        parts.append(f"- Text Accuracy Score: {review.text_accuracy_score}/100")
        parts.append(f"- Brand Alignment Score: {review.brand_alignment_score}/100")
        parts.append(f"- Technical Score: {review.technical_score}/100")
        parts.append(f"- Visual Integrity Score: {review.visual_integrity_score}/100")
        parts.append(f"- Hard Reject: {review.hard_reject}")
        parts.append(f"- Summary: {review.summary}")

        if review.issues:
            parts.append("\n## Issues Found")
            for issue in review.issues:
                severity = issue.get("severity", "unknown")
                issue_type = issue.get("type", "unknown")
                description = issue.get("description", "")
                parts.append(f"- [{severity.upper()}] {issue_type}: {description}")

        parts.append("\n## Brief")
        parts.append(f"- Art Type: {brief.art_type}")
        parts.append(f"- Format: {brief.format}")
        if brief.headline:
            parts.append(f"- Headline: {brief.headline}")
        if brief.description:
            parts.append(f"- Description: {brief.description}")

        if context.creative_direction:
            cd = context.creative_direction
            parts.append("\n## Creative Direction")
            parts.append(f"- Mood: {cd.mood}")
            parts.append(f"- Style: {cd.style}")
            parts.append(f"- Composition: {cd.composition_notes}")
            if cd.color_palette:
                parts.append(f"- Color Palette: {', '.join(cd.color_palette)}")

        parts.append("\nAnalyze the issues and produce an improved prompt that addresses them.")

        return "\n".join(parts)

    def _get_completion_reasoning(self, context: PipelineContext) -> str:
        if context.refinement_history:
            latest = context.refinement_history[-1]
            model_note = f", new model: {latest.new_model}" if latest.new_model else ""
            return f"Strategy: {latest.strategy}{model_note} — {latest.changes_made[:120]}"
        return "Refinement completed"
