from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand import Brand
from app.schemas.brand import BrandCreate, BrandUpdate


async def create_brand(session: AsyncSession, data: BrandCreate) -> Brand:
    brand = Brand(**data.model_dump())
    session.add(brand)
    await session.flush()
    await session.refresh(brand)
    return brand


async def get_brand(session: AsyncSession, brand_id: uuid.UUID) -> Brand | None:
    result = await session.execute(select(Brand).where(Brand.id == brand_id))
    return result.scalar_one_or_none()


async def list_brands(
    session: AsyncSession, skip: int = 0, limit: int = 20
) -> list[Brand]:
    result = await session.execute(
        select(Brand).order_by(Brand.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


async def update_brand(
    session: AsyncSession, brand_id: uuid.UUID, data: BrandUpdate
) -> Brand | None:
    brand = await get_brand(session, brand_id)
    if brand is None:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(brand, field, value)
    await session.flush()
    await session.refresh(brand)
    return brand


async def delete_brand(session: AsyncSession, brand_id: uuid.UUID) -> bool:
    brand = await get_brand(session, brand_id)
    if brand is None:
        return False
    await session.delete(brand)
    await session.flush()
    return True
