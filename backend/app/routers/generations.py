from __future__ import annotations

import logging
import os
import uuid
from dataclasses import asdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_session
from app.models.brief import Brief
from app.models.brand import Brand
from app.models.generation import Generation, PipelineLog, GeneratedImage as GeneratedImageModel
from app.schemas.generation import GenerationResponse, PipelineLogResponse, GeneratedImageResponse
from app.agents.context import PipelineContext, BriefData, BrandGuidelines
from app.tasks.generation_tasks import generate_art_task
from app.config.art_type_config import (
    get_art_type_config,
    validate_formats,
    validate_slides,
    MAX_QUANTITY_PER_FORMAT,
    MAX_GENERATIONS_PER_BATCH,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/generations", tags=["generations"], redirect_slashes=False)


class StartGenerationBody(BaseModel):
    """Optional body for multi-format / batch generation."""
    formats: list[str] | None = None
    quantity: int = 1


def _build_brief_data(brief: Any) -> BriefData:
    """Build BriefData from a Brief ORM model."""
    return BriefData(
        id=str(brief.id),
        art_type=brief.art_type or "",
        format=brief.format or "",
        platform=brief.platform,
        headline=brief.headline,
        body_text=brief.body_text,
        cta_text=brief.cta_text,
        description=brief.description,
        reference_urls=list(brief.reference_urls or []),
        inclusion_urls=list(brief.inclusion_urls or []),
        slides=brief.slides,
        custom_width=brief.custom_width,
        custom_height=brief.custom_height,
    )


def _build_brand_guidelines(brand: Any) -> BrandGuidelines:
    """Build BrandGuidelines from a Brand ORM model."""
    return BrandGuidelines(
        id=str(brand.id),
        name=brand.name,
        primary_colors=list(brand.primary_colors or []),
        secondary_colors=list(brand.secondary_colors or []),
        fonts=brand.fonts or {},
        tone_of_voice=brand.tone_of_voice,
        do_rules=list(brand.do_rules or []),
        dont_rules=list(brand.dont_rules or []),
        logo_url=brand.logo_url,
    )


@router.post(
    "/from-brief/{brief_id}",
    response_model=GenerationResponse | list[GenerationResponse],
    status_code=status.HTTP_201_CREATED,
)
async def start_generation(
    brief_id: uuid.UUID,
    body: StartGenerationBody | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Start the generation pipeline for a brief.

    Without body or with empty formats: single generation (backward compatible).
    With formats/quantity: batch generation with shared Creative Director.
    """
    # Get brief
    result = await session.execute(select(Brief).where(Brief.id == brief_id))
    brief = result.scalar_one_or_none()
    if not brief:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brief not found")

    # Get brand if associated
    brand_guidelines = None
    if brief.brand_id:
        brand_result = await session.execute(select(Brand).where(Brand.id == brief.brand_id))
        brand = brand_result.scalar_one_or_none()
        if brand:
            brand_guidelines = _build_brand_guidelines(brand)

    brief_data = _build_brief_data(brief)

    # Determine formats and quantity
    formats = None
    quantity = 1
    if body:
        formats = body.formats
        quantity = body.quantity

    # Validate quantity
    if quantity < 1 or quantity > MAX_QUANTITY_PER_FORMAT:
        raise HTTPException(
            status_code=400,
            detail=f"Quantidade deve ser entre 1 e {MAX_QUANTITY_PER_FORMAT}",
        )

    # Single generation (backward compatible)
    if not formats or len(formats) == 0:
        pipeline_context = PipelineContext(
            brief_id=str(brief.id),
            brief=brief_data,
            brand=brand_guidelines,
        )

        generation = Generation(
            brief_id=brief.id,
            pipeline_context=pipeline_context.to_dict(),
            status="pending",
        )
        session.add(generation)
        brief.status = "processing"
        await session.commit()
        await session.refresh(generation)

        pipeline_context.generation_id = str(generation.id)
        generation.pipeline_context = pipeline_context.to_dict()
        await session.commit()

        generate_art_task.delay(str(generation.id), pipeline_context.to_dict())
        return GenerationResponse.model_validate(generation)

    # --- Batch / multi-format generation ---
    art_type = brief.art_type or ""

    # Validate formats against art type config
    try:
        validate_formats(art_type, formats)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Validate quantity against art type maxQuantity
    config = get_art_type_config(art_type)
    if config:
        max_qty = config.get("maxQuantity", MAX_QUANTITY_PER_FORMAT)
        if quantity > max_qty:
            art_type_label = config.get("label", art_type)
            raise HTTPException(
                status_code=400,
                detail=f"Quantidade máxima para {art_type_label} é {max_qty}",
            )

    # Validate slides if carousel
    if art_type == "carousel" and brief.slides:
        try:
            validate_slides(brief.slides)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # For carousel with slides, each slide becomes a separate generation
    is_carousel_with_slides = art_type == "carousel" and brief.slides

    if is_carousel_with_slides:
        total_generations = len(brief.slides) * len(formats) * quantity
    else:
        total_generations = len(formats) * quantity

    if total_generations > MAX_GENERATIONS_PER_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"Total de gerações ({total_generations}) excede o máximo de {MAX_GENERATIONS_PER_BATCH}",
        )

    # Run Creative Director once for the batch
    from app.agents.creative_director import CreativeDirectorAgent
    from app.providers.openrouter_client import OpenRouterClient

    shared_cd = None
    first_ctx = PipelineContext(
        brief_id=str(brief.id),
        brief=brief_data,
        brand=brand_guidelines,
    )
    client = OpenRouterClient()
    try:
        creative_director = CreativeDirectorAgent(client)
        first_ctx = await creative_director.run(first_ctx)
        shared_cd = {
            "creative_direction": asdict(first_ctx.creative_direction),
            "enhanced_description": first_ctx.enhanced_description,
        }
        logger.info(f"[{brief.id}] Shared Creative Director completed for batch of {total_generations}")
    except Exception as e:
        logger.warning(f"[{brief.id}] Shared Creative Director failed, each task will run its own: {e}")
        shared_cd = None
    finally:
        await client.close()

    batch_id = uuid.uuid4()
    generations = []

    def _make_brief_data_for_format(fmt: str) -> BriefData:
        return BriefData(
            id=brief_data.id,
            art_type=brief_data.art_type,
            format=fmt,
            platform=brief_data.platform,
            headline=brief_data.headline,
            body_text=brief_data.body_text,
            cta_text=brief_data.cta_text,
            description=brief_data.description,
            reference_urls=brief_data.reference_urls,
            inclusion_urls=brief_data.inclusion_urls,
            slides=brief_data.slides,
            custom_width=brief_data.custom_width,
            custom_height=brief_data.custom_height,
        )

    if is_carousel_with_slides:
        # Each slide x each format x quantity = one generation
        for slide_idx, _slide in enumerate(brief.slides):
            for fmt in formats:
                for _q in range(quantity):
                    fmt_brief_data = _make_brief_data_for_format(fmt)

                    pipeline_context = PipelineContext(
                        brief_id=str(brief.id),
                        brief=fmt_brief_data,
                        brand=brand_guidelines,
                        batch_id=str(batch_id),
                        format_label=fmt,
                        shared_creative_direction=shared_cd,
                        current_slide_index=slide_idx,
                        total_slides=len(brief.slides),
                    )

                    generation = Generation(
                        brief_id=brief.id,
                        batch_id=batch_id,
                        format_label=fmt,
                        pipeline_context=pipeline_context.to_dict(),
                        status="pending",
                    )
                    session.add(generation)
                    generations.append((generation, pipeline_context))
    else:
        for fmt in formats:
            for _q in range(quantity):
                fmt_brief_data = _make_brief_data_for_format(fmt)

                pipeline_context = PipelineContext(
                    brief_id=str(brief.id),
                    brief=fmt_brief_data,
                    brand=brand_guidelines,
                    batch_id=str(batch_id),
                    format_label=fmt,
                    shared_creative_direction=shared_cd,
                )

                generation = Generation(
                    brief_id=brief.id,
                    batch_id=batch_id,
                    format_label=fmt,
                    pipeline_context=pipeline_context.to_dict(),
                    status="pending",
                )
                session.add(generation)
                generations.append((generation, pipeline_context))

    brief.status = "processing"
    await session.commit()

    # Refresh all and dispatch tasks
    responses = []
    for generation, pipeline_context in generations:
        await session.refresh(generation)
        pipeline_context.generation_id = str(generation.id)
        generation.pipeline_context = pipeline_context.to_dict()

    await session.commit()

    for generation, pipeline_context in generations:
        generate_art_task.delay(str(generation.id), pipeline_context.to_dict())
        responses.append(GenerationResponse.model_validate(generation))

    return responses


@router.get("/batch/{batch_id}", response_model=list[GenerationResponse])
async def get_batch_generations(
    batch_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> list[GenerationResponse]:
    """List all generations in a batch."""
    result = await session.execute(
        select(Generation)
        .where(Generation.batch_id == batch_id)
        .order_by(Generation.created_at)
    )
    generations = result.scalars().all()
    if not generations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")
    return [GenerationResponse.model_validate(g) for g in generations]


@router.get("", response_model=list[GenerationResponse])
async def list_generations(
    skip: int = Query(default=0, ge=0, le=10000),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
) -> list[GenerationResponse]:
    result = await session.execute(
        select(Generation).order_by(Generation.created_at.desc()).offset(skip).limit(limit)
    )
    return [GenerationResponse.model_validate(g) for g in result.scalars().all()]


@router.get("/{generation_id}", response_model=GenerationResponse)
async def get_generation(
    generation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    result = await session.execute(
        select(Generation).where(Generation.id == generation_id)
    )
    generation = result.scalar_one_or_none()
    if not generation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation not found")
    return GenerationResponse.model_validate(generation)


@router.get("/{generation_id}/logs", response_model=list[PipelineLogResponse])
async def get_pipeline_logs(
    generation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> list[PipelineLogResponse]:
    result = await session.execute(
        select(PipelineLog)
        .where(PipelineLog.generation_id == generation_id)
        .order_by(PipelineLog.created_at)
    )
    return [PipelineLogResponse.model_validate(log) for log in result.scalars().all()]


@router.get("/{generation_id}/images", response_model=list[GeneratedImageResponse])
async def get_generation_images(
    generation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> list[GeneratedImageResponse]:
    result = await session.execute(
        select(GeneratedImageModel)
        .where(GeneratedImageModel.generation_id == generation_id)
        .order_by(GeneratedImageModel.created_at)
    )
    return [GeneratedImageResponse.model_validate(img) for img in result.scalars().all()]


@router.post("/{generation_id}/retry", response_model=GenerationResponse)
async def retry_generation(
    generation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    result = await session.execute(
        select(Generation).where(Generation.id == generation_id)
    )
    generation = result.scalar_one_or_none()
    if not generation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation not found")
    if generation.status not in ("failed", "completed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only retry failed or completed generations. Stuck generations must be marked as failed first.",
        )

    # Reset and re-dispatch
    generation.status = "pending"
    generation.error_message = None
    generation.started_at = None
    generation.completed_at = None

    # Ensure generation_id is in the pipeline context
    ctx = dict(generation.pipeline_context or {})
    ctx["generation_id"] = str(generation.id)
    generation.pipeline_context = ctx

    await session.commit()

    generate_art_task.delay(str(generation.id), generation.pipeline_context)

    await session.refresh(generation)
    return GenerationResponse.model_validate(generation)


@router.post("/{generation_id}/mark-failed", response_model=GenerationResponse)
async def mark_generation_failed(
    generation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    """Mark a stuck generation (running/pending) as failed so it can be retried."""
    result = await session.execute(
        select(Generation).where(Generation.id == generation_id)
    )
    generation = result.scalar_one_or_none()
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    if generation.status not in ("running", "pending"):
        raise HTTPException(status_code=400, detail="Only running or pending generations can be marked as failed")

    generation.status = "failed"
    generation.error_message = "Manually marked as failed (stuck)"
    await session.commit()
    await session.refresh(generation)
    return GenerationResponse.model_validate(generation)


@router.get("/{generation_id}/download")
async def download_generation_image(
    generation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Download the final image with Content-Disposition: attachment."""
    from app.config import get_settings

    result = await session.execute(
        select(Generation).where(Generation.id == generation_id)
    )
    generation = result.scalar_one_or_none()
    if not generation or not generation.final_image_url:
        raise HTTPException(status_code=404, detail="Image not found")

    settings = get_settings()
    clean = generation.final_image_url.lstrip("/")
    if clean.startswith("storage/"):
        clean = clean[len("storage/"):]
    file_path = os.path.realpath(os.path.join(settings.STORAGE_PATH, clean))
    if not file_path.startswith(os.path.realpath(settings.STORAGE_PATH)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Detect actual file type from extension
    ext = os.path.splitext(file_path)[1].lower()
    media_types = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif"}
    media_type = media_types.get(ext, "image/png")
    filename = f"design-{str(generation_id)[:8]}{ext or '.png'}"
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
    )
