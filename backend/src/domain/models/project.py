from __future__ import annotations

from sqlalchemy import Boolean, CheckConstraint, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.domain.models.base import Base, TimestampMixin


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0"),
        CheckConstraint("length(trim(slug)) > 0"),
    )

    datasets = relationship(  # type: ignore[valid-type]
        "Dataset",
        back_populates="project",
        cascade="all, delete-orphan",
    )
