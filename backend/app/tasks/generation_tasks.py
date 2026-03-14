import asyncio
import uuid as _uuid

from app.tasks.celery_app import celery_app
from app.agents.orchestrator import run_pipeline
from app.database import AsyncSessionLocal
from app.models.generation import Generation
from sqlalchemy import select


@celery_app.task(bind=True, name="generate_art")
def generate_art_task(self, generation_id: str, pipeline_context_dict: dict):
    """Run the full agent pipeline as a Celery task."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(
            _run_pipeline_async(generation_id, pipeline_context_dict, self)
        )
        return result
    finally:
        loop.close()


async def _run_pipeline_async(generation_id: str, context_dict: dict, task):
    """Async wrapper for the pipeline."""
    from app.agents.context import PipelineContext
    from datetime import datetime, timezone

    context = None

    try:
        context = PipelineContext.from_dict(context_dict)

        # Update generation status to running
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Generation).where(Generation.id == _uuid.UUID(generation_id))
            )
            generation = result.scalar_one_or_none()
            if generation:
                generation.status = "running"
                generation.started_at = datetime.now(timezone.utc)
                await session.commit()

        # Run the pipeline
        context = await run_pipeline(context)

        # Update generation with results
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Generation).where(Generation.id == _uuid.UUID(generation_id))
            )
            generation = result.scalar_one_or_none()
            if generation:
                generation.status = "completed" if context.current_status == "completed" else "failed"
                generation.pipeline_context = context.to_dict()
                generation.final_score = context.review.overall_score if context.review else None
                generation.model_used = context.generation_prompt.selected_model if context.generation_prompt else None
                generation.iterations_used = context.iteration + 1
                if context.generated_images:
                    generation.final_image_url = context.generated_images[-1].image_url
                generation.completed_at = datetime.now(timezone.utc)
                if generation.started_at:
                    generation.total_duration_ms = int(
                        (generation.completed_at - generation.started_at).total_seconds() * 1000
                    )
                await session.commit()

        return {"status": "completed", "generation_id": generation_id}

    except Exception as e:
        # Update generation as failed
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Generation).where(Generation.id == _uuid.UUID(generation_id))
            )
            generation = result.scalar_one_or_none()
            if generation:
                generation.status = "failed"
                generation.error_message = str(e)
                if context is not None:
                    generation.pipeline_context = context.to_dict()
                generation.completed_at = datetime.now(timezone.utc)
                await session.commit()

        return {"status": "failed", "error": str(e), "generation_id": generation_id}
