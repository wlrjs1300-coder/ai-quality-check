from __future__ import annotations

import uuid

from datetime import datetime, timezone

from sqlalchemy import DateTime, Boolean, CheckConstraint, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy import Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.domain.models.base import Base, TimestampMixin


class Evaluator(Base, TimestampMixin):
    __tablename__ = "evaluators"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    evaluator_type: Mapped[str] = mapped_column(String(16), nullable=False)
    config: Mapped[dict] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_evaluators_project_name"),
        CheckConstraint("length(trim(name)) > 0"),
        CheckConstraint("evaluator_type IN ('CONTAINS', 'NOT_CONTAINS', 'REGEX')"),
    )

    project = relationship("Project", back_populates="evaluators")
    versions = relationship("EvaluatorVersion", back_populates="evaluator")


class EvaluatorVersion(Base):
    __tablename__ = "evaluator_versions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    evaluator_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("evaluators.id", ondelete="RESTRICT"),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    evaluator_type_snapshot: Mapped[str] = mapped_column(String(16), nullable=False)
    config_snapshot: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("evaluator_id", "version", name="uq_evaluator_versions_evaluator_version"),
        UniqueConstraint("evaluator_id", "content_hash", name="uq_evaluator_versions_evaluator_content_hash"),
        CheckConstraint("version >= 1"),
        CheckConstraint("evaluator_type_snapshot IN ('CONTAINS', 'NOT_CONTAINS', 'REGEX')"),
    )

    evaluator = relationship("Evaluator", back_populates="versions")
