import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, TEXT, VARCHAR, Boolean, DateTime, Float, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    art_type: Mapped[str | None] = mapped_column(VARCHAR(50), nullable=True)
    model: Mapped[str | None] = mapped_column(VARCHAR(100), nullable=True)
    template: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    variables: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    avg_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
