from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.brief import BriefCreate, BriefResponse, BriefUpdate
from app.services import brief_service

router = APIRouter(prefix="/api/briefs", tags=["briefs"])


@router.post("", response_model=BriefResponse, status_code=status.HTTP_201_CREATED)
async def create_brief(
    data: BriefCreate,
    session: AsyncSession = Depends(get_session),
) -> BriefResponse:
    brief = await brief_service.create_brief(session, data)
    return BriefResponse.model_validate(brief)


@router.get("", response_model=list[BriefResponse])
async def list_briefs(
    skip: int = 0,
    limit: int = 20,
    status: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[BriefResponse]:
    briefs = await brief_service.list_briefs(session, skip=skip, limit=limit, status=status)
    return [BriefResponse.model_validate(b) for b in briefs]


@router.get("/{brief_id}", response_model=BriefResponse)
async def get_brief(
    brief_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> BriefResponse:
    brief = await brief_service.get_brief(session, brief_id)
    if brief is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brief not found")
    return BriefResponse.model_validate(brief)


@router.put("/{brief_id}", response_model=BriefResponse)
async def update_brief(
    brief_id: uuid.UUID,
    data: BriefUpdate,
    session: AsyncSession = Depends(get_session),
) -> BriefResponse:
    brief = await brief_service.update_brief(session, brief_id, data)
    if brief is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brief not found")
    return BriefResponse.model_validate(brief)


@router.delete("/{brief_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_brief(
    brief_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    deleted = await brief_service.delete_brief(session, brief_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brief not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
