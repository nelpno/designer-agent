from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BriefCreate(BaseModel):
    art_type: str
    format: str
    brand_id: uuid.UUID | None = None
    platform: str | None = None
    custom_width: int | None = None
    custom_height: int | None = None
    headline: str | None = None
    body_text: str | None = None
    cta_text: str | None = None
    description: str | None = None
    reference_urls: list[str] | None = None
    created_by: str | None = None


class BriefUpdate(BaseModel):
    art_type: str | None = None
    format: str | None = None
    brand_id: uuid.UUID | None = None
    platform: str | None = None
    custom_width: int | None = None
    custom_height: int | None = None
    headline: str | None = None
    body_text: str | None = None
    cta_text: str | None = None
    description: str | None = None
    reference_urls: list[str] | None = None
    created_by: str | None = None
    status: str | None = None


class BriefResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    art_type: str | None
    format: str | None
    brand_id: uuid.UUID | None
    platform: str | None
    custom_width: int | None
    custom_height: int | None
    headline: str | None
    body_text: str | None
    cta_text: str | None
    description: str | None
    reference_urls: list[str] | None
    status: str
    created_by: str | None
    created_at: datetime
    updated_at: datetime
