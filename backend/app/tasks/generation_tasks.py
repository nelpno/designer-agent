import asyncio
import uuid as _uuid

from app.tasks.celery_app import celery_app
from app.agents.orchestrator import run_pipeline
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


async def _get_session():
    """Create a fresh async engine + session for this event loop (Celery worker)."""
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from app.config import get_settings

    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    session = session_factory()
    try:
        yield session
    finally:
        await session.close()
        await engine.dispose()


async def _run_pipeline_async(generation_id: str, context_dict: dict, task):
    """Async wrapper for the pipeline."""
    from app.agents.context import PipelineContext
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from app.config import get_settings
    from datetime import datetime, timezone

    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    context = None
    gen_uuid = _uuid.UUID(generation_id)

    try:
        context = PipelineContext.from_dict(context_dict)

        # Update generation status to running
        async with SessionLocal() as session:
            result = await session.execute(
                select(Generation).where(Generation.id == gen_uuid)
            )
            generation = result.scalar_one_or_none()
            if generation:
                generation.status = "running"
                generation.started_at = datetime.now(timezone.utc)
                await session.commit()

        # Run the pipeline
        context = await run_pipeline(context)

        # Update generation with results
        async with SessionLocal() as session:
            result = await session.execute(
                select(Generation).where(Generation.id == gen_uuid)
            )
            generation = result.scalar_one_or_none()
            if generation:
                generation.status = "completed" if context.current_status == "completed" else "failed"
                generation.pipeline_context = context.to_dict()
                generation.final_score = context.review.overall_score if context.review else None
                if context.review:
                    generation.composition_score = context.review.composition_score
                    generation.text_accuracy_score = context.review.text_accuracy_score
                    generation.brand_alignment_score = context.review.brand_alignment_score
                    generation.technical_score = context.review.technical_score
                    generation.visual_integrity_score = context.review.visual_integrity_score
                    generation.review_summary = context.review.summary
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
        try:
            async with SessionLocal() as session:
                result = await session.execute(
                    select(Generation).where(Generation.id == gen_uuid)
                )
                generation = result.scalar_one_or_none()
                if generation:
                    generation.status = "failed"
                    generation.error_message = str(e)
                    if context is not None:
                        generation.pipeline_context = context.to_dict()
                    generation.completed_at = datetime.now(timezone.utc)
                    await session.commit()
        except Exception:
            pass  # Don't crash the error handler

        return {"status": "failed", "error": str(e), "generation_id": generation_id}

    finally:
        await engine.dispose()
