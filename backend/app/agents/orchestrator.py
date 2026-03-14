import logging
from datetime import datetime, timezone

from app.agents.context import PipelineContext
from app.agents.creative_director import CreativeDirectorAgent
from app.agents.prompt_engineer import PromptEngineerAgent
from app.agents.generator import GeneratorAgent
from app.agents.reviewer import ReviewerAgent
from app.agents.refiner import RefinerAgent
from app.providers.openrouter_client import OpenRouterClient
from app.config import get_settings

logger = logging.getLogger(__name__)


async def run_pipeline(context: PipelineContext) -> PipelineContext:
    """Run the full 5-agent pipeline with review loop."""
    settings = get_settings()
    client = OpenRouterClient()

    try:
        context.started_at = datetime.now(timezone.utc).isoformat()
        context.current_status = "running"

        # Step 1: Creative Director
        logger.info(f"[{context.brief_id}] Running Creative Director...")
        creative_director = CreativeDirectorAgent(client)
        context = await creative_director.run(context)

        # Step 2-4: Generation loop (Prompt Engineer → Generator → Reviewer)
        max_iterations = settings.MAX_ITERATIONS
        if max_iterations < 1:
            raise ValueError("MAX_ITERATIONS must be >= 1")
        threshold = settings.QUALITY_THRESHOLD

        for iteration in range(max_iterations):
            context.iteration = iteration
            logger.info(f"[{context.brief_id}] Iteration {iteration + 1}/{max_iterations}")

            # Step 2: Prompt Engineer (only on first iteration; subsequent ones use refined prompt)
            if iteration == 0:
                prompt_engineer = PromptEngineerAgent(client)
                context = await prompt_engineer.run(context)

            # Step 3: Generator
            generator = GeneratorAgent(client)
            context = await generator.run(context)

            # Step 4: Reviewer
            reviewer = ReviewerAgent(client)
            context = await reviewer.run(context)

            # Check if approved
            if context.review and context.review.approved:
                logger.info(
                    f"[{context.brief_id}] Approved with score {context.review.overall_score}"
                )
                context.current_status = "completed"
                break

            # Step 5: Refiner (if not approved and more iterations remain)
            if iteration < max_iterations - 1:
                logger.info(
                    f"[{context.brief_id}] Not approved "
                    f"(score: {context.review.overall_score if context.review else 'N/A'}). "
                    "Refining..."
                )
                refiner = RefinerAgent(client)
                context = await refiner.run(context)
            else:
                logger.info(
                    f"[{context.brief_id}] Max iterations reached. Using best result."
                )
                context.current_status = "completed"

        context.completed_at = datetime.now(timezone.utc).isoformat()
        return context

    finally:
        await client.close()
