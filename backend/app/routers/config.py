from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.config.art_type_config import get_all_configs

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/art-types")
async def get_art_types() -> dict[str, dict[str, Any]]:
    """Return all art type configurations."""
    return get_all_configs()
