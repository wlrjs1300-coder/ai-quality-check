from __future__ import annotations

import uuid

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, JSON, Boolean, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy import Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.domain.models.base import Base, TimestampMixin


class Target(Base, TimestampMixin):
    __tablename__ = "targets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    target_type: Mapped[str] = mapped_column(String(16), nullable=False)
    config: Mapped[dict] = mapped_column(JSON().with_variant(JSONB(), "postgresql"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_targets_project_name"),
        CheckConstraint("length(trim(name)) > 0"),
        CheckConstraint("target_type IN ('MOCK')"),
    )

    project = relationship("Project", back_populates="targets")
    versions = relationship("TargetVersion", back_populates="target")


class TargetVersion(Base):
    __tablename__ = "target_versions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("targets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    config_snapshot: Mapped[dict] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
    )
    response_strategy: Mapped[str] = mapped_column(String(16), nullable=False, default="FIXED", server_default="FIXED")
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    failure_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("target_id", "version", name="uq_target_versions_target_version"),
        UniqueConstraint("target_id", "content_hash", name="uq_target_versions_target_content_hash"),
        CheckConstraint("version >= 1"),
        CheckConstraint("response_strategy IN ('FIXED', 'CASE_BASED', 'SCENARIO_BASED')"),
        CheckConstraint("latency_ms >= 0"),
        CheckConstraint("failure_rate >= 0 AND failure_rate <= 1"),
    )

    target = relationship("Target", back_populates="versions")
