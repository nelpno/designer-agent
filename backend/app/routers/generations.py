from __future__ import annotations

import asyncio
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
from app.providers.openrouter_client import OpenRouterClient
from app.config.art_type_config import (
    get_art_type_config,
    validate_formats,
    validate_slides,
    MAX_QUANTITY_PER_FORMAT,
    MAX_GENERATIONS_PER_BATCH,
)

logger = logging.getLogger(__name__)


async def _generate_batch_visual_template(
    client: OpenRouterClient,
    creative_direction: dict,
    brief_data: "BriefData",
    brand_guidelines: "BrandGuidelines | None",
    *,
    is_carousel: bool = False,
    formats: list[str] | None = None,
) -> str | None:
    """Generate a detailed visual template for batch generations.

    For carousels: locks layout + style so every slide looks identical.
    For multi-format: locks style (colors, imagery, decorations, typography)
    but instructs layout adaptation per aspect ratio.
    """
    from app.config import get_settings

    settings = get_settings()

    slides_summary = ""
    if is_carousel and brief_data.slides:
        lines = []
        for i, s in enumerate(brief_data.slides, 1):
            h = s.get("headline", "")
            b = s.get("body_text", "")
            lines.append(f"  Slide {i}: headline=\"{h}\", body=\"{b}\"")
        slides_summary = "\n".join(lines)

    brand_info = ""
    if brand_guidelines:
        parts = [f"Brand: {brand_guidelines.name}"]
        if brand_guidelines.primary_colors:
            parts.append(f"Primary Colors: {', '.join(brand_guidelines.primary_colors)}")
        if brand_guidelines.secondary_colors:
            parts.append(f"Secondary Colors: {', '.join(brand_guidelines.secondary_colors)}")
        if brand_guidelines.logo_url:
            parts.append("Has logo: yes")
        brand_info = "\n".join(parts)

    if is_carousel:
        system_prompt = """You are a Senior Art Director creating a VISUAL TEMPLATE for a carousel post.

Your job is to define ONE concrete, reusable visual template that ALL slides must follow exactly.
This ensures every slide in the carousel looks like it belongs to the same set.

Output a single block of text (NOT JSON) describing the exact visual template. Be extremely specific:

1. **Background**: exact colors (HEX), gradient direction, pattern/texture if any
2. **Layout Grid**: where the headline goes, where body text goes, where the photo/illustration area is, where the logo sits — use positions like "top-left", "center-right", "bottom-right corner"
3. **Imagery Style**: choose ONE — real photography OR illustration OR flat graphic. Do NOT mix styles across slides.
4. **Photo/Image Treatment**: if using photos, describe the exact frame/mask shape (rounded rectangle, organic curve, circle crop, etc.) and its position
5. **Decorative Elements**: exact shapes, colors, positions of any decorations (curves, lines, icons, patterns). Be specific enough that every slide uses the SAME decorations in the SAME positions.
6. **Headline Typography**: color (HEX), weight (bold/black/etc), case (uppercase/mixed), approximate relative size (large/medium), position
7. **Body Text Typography**: color (HEX), weight, size relative to headline, position
8. **Logo Placement**: exact corner/position, approximate size
9. **Slide Number/Indicator**: if applicable, where and how

CRITICAL RULES:
- Be CONCRETE, not abstract. "warm tones" is BAD. "#F5E6D3 cream background with #C49A3C golden accents" is GOOD.
- Every visual decision must be specific enough that two different artists would produce nearly identical layouts.
- Choose a SINGLE imagery style (photo OR illustration) and stick with it.
- The template must work for ALL slides — some may have photos, some may not. Define what happens in both cases.
- NEVER include pixel measurements — use relative positions and proportional descriptions.
- Write in English."""
    else:
        formats_str = ", ".join(formats or [])
        system_prompt = f"""You are a Senior Art Director creating a VISUAL STYLE GUIDE for a design that will be generated in multiple aspect ratios: {formats_str}.

Your job is to define ONE concrete visual style that ALL format variations must follow.
The LAYOUT will naturally adapt to each aspect ratio, but the STYLE must be identical.

Output a single block of text (NOT JSON) describing the exact visual style. Be extremely specific:

1. **Background**: exact colors (HEX), gradient direction, pattern/texture if any
2. **Imagery Style**: choose ONE — real photography OR illustration OR flat graphic. Describe the exact scene/subject.
3. **Photo/Image Treatment**: if using photos, describe the exact treatment (frame shape, filters, lighting style)
4. **Decorative Elements**: exact shapes, colors of any decorations (curves, lines, icons, patterns)
5. **Headline Typography**: color (HEX), weight (bold/black/etc), case (uppercase/mixed)
6. **Body Text Typography**: color (HEX), weight, size relative to headline
7. **Logo Placement**: preferred corner/position
8. **Color Treatment**: exact color usage — which elements get which HEX colors

LAYOUT ADAPTATION RULES:
- For square (1:1): balanced composition, elements can be centered or split left-right
- For vertical (9:16): stack elements top-to-bottom, more vertical white space
- For horizontal (16:9): spread elements left-to-right, cinematic feel
- The SAME visual identity must be instantly recognizable across all formats

CRITICAL RULES:
- Be CONCRETE, not abstract. "warm tones" is BAD. "#F5E6D3 cream background with #C49A3C golden accents" is GOOD.
- Choose a SINGLE imagery style and stick with it across all formats.
- NEVER include pixel measurements.
- Write in English."""

    task_line = (
        "define the EXACT visual template that every slide in this carousel must follow."
        if is_carousel
        else f"define the EXACT visual style that all format variations ({', '.join(formats or [])}) must follow."
    )

    user_prompt = f"""## Creative Direction (already defined)
- Mood: {creative_direction.get('mood', '')}
- Style: {creative_direction.get('style', '')}
- Composition: {creative_direction.get('composition_notes', '')}
- Color Palette: {', '.join(creative_direction.get('color_palette', []))}
- Typography: {creative_direction.get('typography_direction', '')}
{f'''
## Slides
{slides_summary}
''' if slides_summary else ''}
## Brand
{brand_info}

## Description
{brief_data.description or ''}

Based on the creative direction above, {task_line}"""

    try:
        response = await client.chat(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=2048,
        )
        template = response.strip()
        label = "carousel" if is_carousel else "multi-format"
        logger.info(f"Batch visual template ({label}) generated ({len(template)} chars)")
        return template
    except Exception as e:
        logger.warning(f"Failed to generate batch visual template: {e}")
        return None


async def _wait_for_anchor_image(
    session: AsyncSession,
    generation_id: uuid.UUID,
    timeout_seconds: int = 120,
) -> str | None:
    """Poll DB for first generation to complete and return its final_image_url."""
    import asyncio as _asyncio
    deadline = _asyncio.get_event_loop().time() + timeout_seconds
    while _asyncio.get_event_loop().time() < deadline:
        await _asyncio.sleep(2)
        # Expire cached state so next query gets fresh data
        await session.expire_all()
        result = await session.execute(
            select(Generation).where(Generation.id == generation_id)
        )
        gen = result.scalar_one_or_none()
        if gen and gen.status == "completed" and gen.final_image_url:
            logger.info(f"Anchor image ready: {gen.final_image_url}")
            return gen.final_image_url
        if gen and gen.status == "failed":
            logger.warning(f"Anchor generation {generation_id} failed, proceeding without anchor")
            return None
    logger.warning(f"Anchor generation timed out after {timeout_seconds}s")
    return None


router = APIRouter(prefix="/api/generations", tags=["generations"], redirect_slashes=False)


class StartGenerationBody(BaseModel):
    """Optional body for multi-format / batch generation."""
    formats: list[str] | None = None
    quantity: int = 1


class RetryWithEditBody(BaseModel):
    description: str | None = None


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

        # Generate visual template for batches to ensure visual coherence
        if shared_cd:
            needs_template = is_carousel_with_slides or len(formats) > 1
            if needs_template:
                try:
                    template = await asyncio.wait_for(
                        _generate_batch_visual_template(
                            client,
                            shared_cd["creative_direction"],
                            brief_data,
                            brand_guidelines,
                            is_carousel=is_carousel_with_slides,
                            formats=formats,
                        ),
                        timeout=20.0,
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"[{brief.id}] Visual template generation timed out (20s)")
                    template = None
                if template:
                    key = "carousel_visual_template" if is_carousel_with_slides else "batch_visual_template"
                    shared_cd[key] = template
                    logger.info(f"[{brief.id}] Visual template ({key}) added to shared context")
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

    # Phase 1: Dispatch FIRST generation only
    first_gen, first_ctx = generations[0]
    generate_art_task.delay(str(first_gen.id), first_ctx.to_dict())

    if len(generations) > 1:
        # Wait for first generation to produce anchor image
        anchor_url = await _wait_for_anchor_image(session, first_gen.id, timeout_seconds=120)

        # Phase 2: Dispatch remaining with anchor reference
        if anchor_url:
            for generation, pipeline_context in generations[1:]:
                pipeline_context.anchor_image_url = anchor_url
                generation.pipeline_context = pipeline_context.to_dict()
            await session.commit()

        for generation, pipeline_context in generations[1:]:
            generate_art_task.delay(str(generation.id), pipeline_context.to_dict())

    responses = [GenerationResponse.model_validate(gen) for gen, _ in generations]
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


@router.post("/{generation_id}/retry-edit", response_model=GenerationResponse)
async def retry_with_edit(
    generation_id: uuid.UUID,
    body: RetryWithEditBody | None = None,
    session: AsyncSession = Depends(get_session),
) -> GenerationResponse:
    """Retry a generation with an optionally modified description."""
    result = await session.execute(
        select(Generation).where(Generation.id == generation_id)
    )
    generation = result.scalar_one_or_none()
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    if generation.status not in ("failed", "completed"):
        raise HTTPException(status_code=400, detail="Can only retry failed or completed generations")

    generation.status = "pending"
    generation.error_message = None
    generation.started_at = None
    generation.completed_at = None

    ctx = dict(generation.pipeline_context or {})
    ctx["generation_id"] = str(generation.id)
    if body and body.description:
        if "brief" in ctx:
            ctx["brief"]["description"] = body.description
        # Clear shared context so pipeline re-runs from scratch with new description
        ctx.pop("shared_creative_direction", None)
        ctx.pop("enhanced_description", None)
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


@router.get("/batch/{batch_id}/download")
async def download_batch_zip(
    batch_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    """Download all completed images from a batch as a ZIP file."""
    import io
    import zipfile
    from fastapi.responses import StreamingResponse

    result = await session.execute(
        select(Generation)
        .where(Generation.batch_id == batch_id, Generation.status == "completed")
        .order_by(Generation.created_at)
    )
    generations_list = result.scalars().all()
    if not generations_list:
        raise HTTPException(status_code=404, detail="No completed images in this batch")

    settings = get_settings()
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, gen in enumerate(generations_list, 1):
            if not gen.final_image_url:
                continue
            clean = gen.final_image_url.lstrip("/")
            if clean.startswith("storage/"):
                clean = clean[len("storage/"):]
            file_path = os.path.realpath(os.path.join(settings.STORAGE_PATH, clean))
            if not file_path.startswith(os.path.realpath(settings.STORAGE_PATH)):
                continue
            if not os.path.isfile(file_path):
                continue
            ext = os.path.splitext(file_path)[1] or ".png"
            label = gen.format_label or "img"
            filename = f"{i:02d}_{label}{ext}"
            zf.write(file_path, filename)

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="batch-{str(batch_id)[:8]}.zip"'},
    )
