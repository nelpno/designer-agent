import logging
import uuid as _uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.agents.context import PipelineContext
from app.agents.creative_director import CreativeDirectorAgent
from app.agents.prompt_engineer import PromptEngineerAgent
from app.agents.generator import GeneratorAgent
from app.agents.reviewer import ReviewerAgent
from app.agents.refiner import RefinerAgent
from app.models.generation import PipelineLog, Generation
from app.providers.openrouter_client import OpenRouterClient
from app.config import get_settings

logger = logging.getLogger(__name__)


async def _save_agent_log(
    session_factory,
    generation_id: str,
    agent_name: str,
    iteration: int,
    decision: str,
    reasoning: str,
    duration_ms: int | None = None,
):
    """Persist a pipeline log entry to the database immediately. Non-fatal on failure."""
    try:
        async with session_factory() as session:
            log = PipelineLog(
                generation_id=_uuid.UUID(generation_id),
                agent_name=agent_name,
                iteration=iteration,
                decision=decision,
                reasoning=reasoning,
            duration_ms=duration_ms,
        )
        session.add(log)
        await session.commit()
    except Exception as e:
        logger.warning(f"Failed to persist pipeline log for {agent_name}: {e}")


async def run_pipeline(context: PipelineContext) -> PipelineContext:
    """Run the full 5-agent pipeline with review loop."""
    settings = get_settings()
    client = OpenRouterClient()

    # Create a session factory for persisting logs in real-time
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    generation_id = context.generation_id or context.brief_id

    try:
        context.started_at = datetime.now(timezone.utc).isoformat()
        context.current_status = "running"

        # Step 1: Creative Director
        logger.info(f"[{context.brief_id}] Running Creative Director...")
        creative_director = CreativeDirectorAgent(client)
        context = await creative_director.run(context)

        # Save log immediately
        last_log = context.decision_log[-1] if context.decision_log else None
        if last_log:
            await _save_agent_log(
                SessionLocal, generation_id, last_log.agent_name,
                0, last_log.decision, last_log.reasoning,
            )

        # Step 2-4: Generation loop (Prompt Engineer → Generator → Reviewer)
        max_iterations = settings.MAX_ITERATIONS
        if max_iterations < 1:
            raise ValueError("MAX_ITERATIONS must be >= 1")

        for iteration in range(max_iterations):
            context.iteration = iteration
            logger.info(f"[{context.brief_id}] Iteration {iteration + 1}/{max_iterations}")
            log_count_before = len(context.decision_log)

            # Step 2: Prompt Engineer (only on first iteration; subsequent ones use refined prompt)
            if iteration == 0:
                prompt_engineer = PromptEngineerAgent(client)
                context = await prompt_engineer.run(context)

                for log_entry in context.decision_log[log_count_before:]:
                    await _save_agent_log(
                        SessionLocal, generation_id, log_entry.agent_name,
                        iteration, log_entry.decision, log_entry.reasoning,
                    )
                log_count_before = len(context.decision_log)

            # Step 3: Generator
            generator = GeneratorAgent(client)
            context = await generator.run(context)

            for log_entry in context.decision_log[log_count_before:]:
                await _save_agent_log(
                    SessionLocal, generation_id, log_entry.agent_name,
                    iteration, log_entry.decision, log_entry.reasoning,
                )
            log_count_before = len(context.decision_log)

            # Step 4: Reviewer
            reviewer = ReviewerAgent(client)
            context = await reviewer.run(context)

            for log_entry in context.decision_log[log_count_before:]:
                await _save_agent_log(
                    SessionLocal, generation_id, log_entry.agent_name,
                    iteration, log_entry.decision, log_entry.reasoning,
                )
            log_count_before = len(context.decision_log)

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

                for log_entry in context.decision_log[log_count_before:]:
                    await _save_agent_log(
                        SessionLocal, generation_id, log_entry.agent_name,
                        iteration, log_entry.decision, log_entry.reasoning,
                    )
                log_count_before = len(context.decision_log)
            else:
                logger.info(
                    f"[{context.brief_id}] Max iterations reached. Using best result."
                )
                context.current_status = "completed"

        context.completed_at = datetime.now(timezone.utc).isoformat()
        return context

    finally:
        await client.close()
        await engine.dispose()
