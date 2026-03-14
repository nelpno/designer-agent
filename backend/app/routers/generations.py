from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_session
from app.models.brief import Brief
from app.models.brand import Brand
from app.models.generation import Generation, PipelineLog, GeneratedImage as GeneratedImageModel
from app.schemas.generation import GenerationResponse, PipelineLogResponse, GeneratedImageResponse
from app.agents.context import PipelineContext, BriefData, BrandGuidelines
from app.tasks.generation_tasks import generate_art_task

router = APIRouter(prefix="/api/generations", tags=["generations"])


@router.post("/from-brief/{brief_id}", response_model=GenerationResponse, status_code=status.HTTP_201_CREATED)
async def start_generation(
    brief_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    """Start the generation pipeline for a brief."""
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
            brand_guidelines = BrandGuidelines(
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

    # Build PipelineContext
    brief_data = BriefData(
        id=str(brief.id),
        art_type=brief.art_type or "",
        format=brief.format or "",
        platform=brief.platform,
        headline=brief.headline,
        body_text=brief.body_text,
        cta_text=brief.cta_text,
        description=brief.description,
        reference_urls=list(brief.reference_urls or []),
        custom_width=brief.custom_width,
        custom_height=brief.custom_height,
    )

    pipeline_context = PipelineContext(
        brief_id=str(brief.id),
        brief=brief_data,
        brand=brand_guidelines,
    )

    # Create generation record
    generation = Generation(
        brief_id=brief.id,
        pipeline_context=pipeline_context.to_dict(),
        status="pending",
    )
    session.add(generation)

    # Update brief status
    brief.status = "processing"

    await session.commit()
    await session.refresh(generation)

    # Set generation_id in context so storage paths are unique per generation
    pipeline_context.generation_id = str(generation.id)
    generation.pipeline_context = pipeline_context.to_dict()
    await session.commit()

    # Dispatch Celery task
    generate_art_task.delay(str(generation.id), pipeline_context.to_dict())

    return GenerationResponse.model_validate(generation)


@router.get("/", response_model=list[GenerationResponse])
async def list_generations(
    skip: int = 0,
    limit: int = 20,
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
            detail="Can only retry failed or completed generations",
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
