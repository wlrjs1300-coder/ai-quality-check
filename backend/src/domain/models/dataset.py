from __future__ import annotations

import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.domain.models.base import Base, TimestampMixin


class Dataset(Base, TimestampMixin):
    __tablename__ = "datasets"

    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="RESTRICT"),
    )
    name: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_datasets_project_name"),
        CheckConstraint("length(trim(name)) > 0"),
    )

    project = relationship("Project", back_populates="datasets")
    evaluation_cases = relationship(  # type: ignore[valid-type]
        "EvaluationCase",
        back_populates="dataset",
        cascade="all, delete-orphan",
    )
    dataset_versions = relationship(  # type: ignore[valid-type]
        "DatasetVersion",
        back_populates="dataset",
    )
