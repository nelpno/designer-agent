from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class BrandCreate(BaseModel):
    name: str
    logo_url: str | None = None
    primary_colors: list[str] | None = None
    secondary_colors: list[str] | None = None
    fonts: dict | None = None
    tone_of_voice: str | None = None
    do_rules: list[str] | None = None
    dont_rules: list[str] | None = None
    reference_images: list[dict] | None = None


class BrandUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    primary_colors: list[str] | None = None
    secondary_colors: list[str] | None = None
    fonts: dict | None = None
    tone_of_voice: str | None = None
    do_rules: list[str] | None = None
    dont_rules: list[str] | None = None
    reference_images: list[dict] | None = None


class BrandResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    logo_url: str | None
    primary_colors: list[str] | None
    secondary_colors: list[str] | None
    fonts: dict | None
    tone_of_voice: str | None
    do_rules: list[str] | None
    dont_rules: list[str] | None
    reference_images: list[dict] | None
    created_at: datetime
    updated_at: datetime
