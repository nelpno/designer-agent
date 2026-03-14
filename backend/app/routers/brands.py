from __future__ import annotations

import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.brand import BrandCreate, BrandResponse, BrandUpdate
from app.services import brand_service

router = APIRouter(prefix="/api/brands", tags=["brands"])


@router.post("", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    data: BrandCreate,
    session: AsyncSession = Depends(get_session),
) -> BrandResponse:
    brand = await brand_service.create_brand(session, data)
    return BrandResponse.model_validate(brand)


@router.get("", response_model=list[BrandResponse])
async def list_brands(
    skip: int = 0,
    limit: int = 20,
    session: AsyncSession = Depends(get_session),
) -> list[BrandResponse]:
    brands = await brand_service.list_brands(session, skip=skip, limit=limit)
    return [BrandResponse.model_validate(b) for b in brands]


@router.post("/discover")
async def discover_brand(
    website_url: str,
    body: dict | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Auto-discover brand guidelines from a website URL. Optionally receives logo as base64 for color analysis."""
    from app.services.brand_discovery import discover_brand_from_url

    logo_base64 = (body or {}).get("logo_base64") if body else None

    try:
        brand_data = await discover_brand_from_url(website_url, logo_base64=logo_base64)
        return {"discovered": brand_data, "message": "Brand data discovered. Review and create the brand."}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not fetch website: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Discovery failed: {str(e)}")


@router.post("/discover-and-create", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def discover_and_create_brand(
    website_url: str,
    session: AsyncSession = Depends(get_session),
) -> BrandResponse:
    """Auto-discover brand guidelines from a website URL and immediately create the brand."""
    from app.services.brand_discovery import discover_brand_from_url

    try:
        brand_data = await discover_brand_from_url(website_url)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not fetch website: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Discovery failed: {str(e)}")

    create_data = BrandCreate(
        name=brand_data.get("name", "Discovered Brand"),
        primary_colors=brand_data.get("primary_colors", []),
        secondary_colors=brand_data.get("secondary_colors", []),
        fonts=brand_data.get("fonts", {}),
        tone_of_voice=brand_data.get("tone_of_voice"),
        do_rules=brand_data.get("do_rules", []),
        dont_rules=brand_data.get("dont_rules", []),
    )

    brand = await brand_service.create_brand(session, create_data)
    return BrandResponse.model_validate(brand)


@router.get("/{brand_id}", response_model=BrandResponse)
async def get_brand(
    brand_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> BrandResponse:
    brand = await brand_service.get_brand(session, brand_id)
    if brand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    return BrandResponse.model_validate(brand)


@router.put("/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: uuid.UUID,
    data: BrandUpdate,
    session: AsyncSession = Depends(get_session),
) -> BrandResponse:
    brand = await brand_service.update_brand(session, brand_id, data)
    if brand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    return BrandResponse.model_validate(brand)


@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_brand(
    brand_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    deleted = await brand_service.delete_brand(session, brand_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
