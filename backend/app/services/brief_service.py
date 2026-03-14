from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brief import Brief
from app.schemas.brief import BriefCreate, BriefUpdate


async def create_brief(session: AsyncSession, data: BriefCreate) -> Brief:
    brief = Brief(**data.model_dump())
    session.add(brief)
    await session.flush()
    await session.refresh(brief)
    return brief


async def get_brief(session: AsyncSession, brief_id: uuid.UUID) -> Brief | None:
    result = await session.execute(select(Brief).where(Brief.id == brief_id))
    return result.scalar_one_or_none()


async def list_briefs(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    status: str | None = None,
) -> list[Brief]:
    query = select(Brief)
    if status is not None:
        query = query.where(Brief.status == status)
    query = query.order_by(Brief.created_at.desc()).offset(skip).limit(limit)
    result = await session.execute(query)
    return list(result.scalars().all())


async def update_brief(
    session: AsyncSession, brief_id: uuid.UUID, data: BriefUpdate
) -> Brief | None:
    brief = await get_brief(session, brief_id)
    if brief is None:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(brief, field, value)
    await session.flush()
    await session.refresh(brief)
    return brief


async def delete_brief(session: AsyncSession, brief_id: uuid.UUID) -> bool:
    brief = await get_brief(session, brief_id)
    if brief is None:
        return False
    await session.delete(brief)
    await session.flush()
    return True
