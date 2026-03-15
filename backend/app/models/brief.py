import uuid
from datetime import datetime

from sqlalchemy import ARRAY, JSON, TEXT, VARCHAR, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Brief(Base):
    __tablename__ = "briefs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    brand_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("brands.id", ondelete="SET NULL"),
        nullable=True,
    )
    art_type: Mapped[str | None] = mapped_column(VARCHAR(50), nullable=True)
    platform: Mapped[str | None] = mapped_column(VARCHAR(50), nullable=True)
    format: Mapped[str | None] = mapped_column(VARCHAR(50), nullable=True)
    custom_width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    custom_height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    headline: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    body_text: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    cta_text: Mapped[str | None] = mapped_column(VARCHAR(100), nullable=True)
    description: Mapped[str | None] = mapped_column(TEXT, nullable=True)
    reference_urls: Mapped[list[str] | None] = mapped_column(ARRAY(TEXT), nullable=True)
    slides: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    inclusion_urls: Mapped[list[str] | None] = mapped_column(ARRAY(TEXT), nullable=True)
    status: Mapped[str] = mapped_column(VARCHAR(20), nullable=False, server_default="draft")
    created_by: Mapped[str | None] = mapped_column(VARCHAR(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    brand: Mapped["Brand"] = relationship("Brand", lazy="selectin")  # noqa: F821
