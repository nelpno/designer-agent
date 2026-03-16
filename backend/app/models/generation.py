import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, TEXT, VARCHAR, Boolean, DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Generation(Base):
    __tablename__ = "generations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    brief_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("briefs.id", ondelete="SET NULL"),
        nullable=True,
    )
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    format_label: Mapped[str | None] = mapped_column(VARCHAR(20), nullable=True)
    pipeline_context: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    final_image_url: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    final_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    composition_score: Mapped[int | None] = mapped_column(nullable=True)
    text_accuracy_score: Mapped[int | None] = mapped_column(nullable=True)
    brand_alignment_score: Mapped[int | None] = mapped_column(nullable=True)
    technical_score: Mapped[int | None] = mapped_column(nullable=True)
    visual_integrity_score: Mapped[int | None] = mapped_column(nullable=True)
    review_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_used: Mapped[str | None] = mapped_column(VARCHAR(100), nullable=True)
    iterations_used: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    status: Mapped[str] = mapped_column(VARCHAR(20), nullable=False, server_default="pending")
    error_message: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    brief: Mapped["Brief"] = relationship("Brief", lazy="selectin")  # noqa: F821
    pipeline_logs: Mapped[list["PipelineLog"]] = relationship(
        "PipelineLog", back_populates="generation", lazy="selectin"
    )
    generated_images: Mapped[list["GeneratedImage"]] = relationship(
        "GeneratedImage", back_populates="generation", lazy="selectin"
    )


class PipelineLog(Base):
    __tablename__ = "pipeline_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    generation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("generations.id", ondelete="CASCADE"),
        nullable=True,
    )
    agent_name: Mapped[str | None] = mapped_column(VARCHAR(50), nullable=True)
    iteration: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    input_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    output_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    decision: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    reasoning: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    generation: Mapped["Generation"] = relationship("Generation", back_populates="pipeline_logs")


class GeneratedImage(Base):
    __tablename__ = "generated_images"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    generation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("generations.id", ondelete="CASCADE"),
        nullable=True,
    )
    iteration: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    image_url: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    model_used: Mapped[str | None] = mapped_column(VARCHAR(100), nullable=True)
    prompt_used: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    negative_prompt: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    generation_params: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    review_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    review_details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    is_final: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    generation: Mapped["Generation"] = relationship(
        "Generation", back_populates="generated_images"
    )
