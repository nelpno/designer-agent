from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.database import get_session
from app.models.generation import Generation

router = APIRouter(prefix="/api/gallery", tags=["gallery"])

@router.get("/")
async def get_gallery(
    skip: int = 0,
    limit: int = 50,
    art_type: str | None = None,
    model_used: str | None = None,
    min_score: int | None = None,
    session: AsyncSession = Depends(get_session)
):
    """Get all completed generations with final images for the gallery."""
    query = select(Generation).where(
        Generation.status == "completed",
        Generation.final_image_url.isnot(None)
    )

    if art_type:
        query = query.where(Generation.pipeline_context["brief"]["art_type"].astext == art_type)
    if model_used:
        query = query.where(Generation.model_used == model_used)
    if min_score:
        query = query.where(Generation.final_score >= min_score)

    query = query.order_by(Generation.created_at.desc()).offset(skip).limit(limit)
    result = await session.execute(query)
    generations = result.scalars().all()

    # Build gallery items
    items = []
    for gen in generations:
        ctx = gen.pipeline_context or {}
        brief = ctx.get("brief", {})
        items.append({
            "id": str(gen.id),
            "brief_id": str(gen.brief_id),
            "image_url": gen.final_image_url,
            "score": gen.final_score,
            "model_used": gen.model_used,
            "art_type": brief.get("art_type", "unknown"),
            "platform": brief.get("platform"),
            "headline": brief.get("headline"),
            "iterations": gen.iterations_used,
            "created_at": gen.created_at.isoformat() if gen.created_at else None,
            "duration_ms": gen.total_duration_ms,
        })

    return items


@router.get("/stats")
async def get_gallery_stats(session: AsyncSession = Depends(get_session)):
    """Get gallery statistics."""
    # Total generations
    total_result = await session.execute(
        select(func.count()).select_from(Generation)
    )
    total = total_result.scalar() or 0

    # Completed generations
    completed_result = await session.execute(
        select(func.count()).select_from(Generation).where(Generation.status == "completed")
    )
    completed = completed_result.scalar() or 0

    # Average score
    avg_result = await session.execute(
        select(func.avg(Generation.final_score)).where(Generation.final_score.isnot(None))
    )
    avg_score = round(avg_result.scalar() or 0, 1)

    # Models used distribution
    models_result = await session.execute(
        select(
            Generation.model_used,
            func.count().label("count")
        ).where(
            Generation.model_used.isnot(None)
        ).group_by(Generation.model_used)
    )
    models_dist = {row[0]: row[1] for row in models_result.all()}

    # Status distribution
    status_result = await session.execute(
        select(
            Generation.status,
            func.count().label("count")
        ).group_by(Generation.status)
    )
    status_dist = {row[0]: row[1] for row in status_result.all()}

    return {
        "total_generations": total,
        "completed_generations": completed,
        "average_score": avg_score,
        "models_distribution": models_dist,
        "status_distribution": status_dist,
    }
