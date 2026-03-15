from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class PipelineLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    generation_id: uuid.UUID | None
    agent_name: str | None
    iteration: int
    input_data: dict[str, Any] | None
    output_data: dict[str, Any] | None
    decision: str | None
    reasoning: str | None
    duration_ms: int | None
    created_at: datetime


class GeneratedImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    generation_id: uuid.UUID | None
    iteration: int
    image_url: str | None
    thumbnail_url: str | None
    model_used: str | None
    prompt_used: str | None
    negative_prompt: str | None
    generation_params: dict[str, Any] | None
    review_score: int | None
    review_details: dict[str, Any] | None
    is_final: bool
    created_at: datetime


class GenerationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    brief_id: uuid.UUID | None
    batch_id: uuid.UUID | None = None
    format_label: str | None = None
    pipeline_context: dict[str, Any] | None
    final_image_url: str | None
    final_score: int | None
    model_used: str | None
    iterations_used: int
    status: str
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    total_duration_ms: int | None
    created_at: datetime
    pipeline_logs: list[PipelineLogResponse]
    generated_images: list[GeneratedImageResponse]
