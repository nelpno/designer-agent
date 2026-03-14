import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ARRAY, JSON, TEXT, VARCHAR, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(VARCHAR(255), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    primary_colors: Mapped[list | None] = mapped_column(JSON, nullable=True)
    secondary_colors: Mapped[list | None] = mapped_column(JSON, nullable=True)
    fonts: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    tone_of_voice: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    do_rules: Mapped[list[str] | None] = mapped_column(ARRAY(TEXT), nullable=True)
    dont_rules: Mapped[list[str] | None] = mapped_column(ARRAY(TEXT), nullable=True)
    reference_images: Mapped[list | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
