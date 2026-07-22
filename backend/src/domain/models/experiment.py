from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import JSON
from sqlalchemy import Uuid
from sqlalchemy.dialects import postgresql
from src.domain.models.base import TimestampMixin
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column

from src.domain.models.base import Base


class Experiment(Base, TimestampMixin):
    __tablename__ = "experiments"

    dataset_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("dataset_versions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    target_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("target_versions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    evaluator_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("evaluator_versions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="CREATED", server_default="CREATED")
    total_cases: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pass_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fail_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        CheckConstraint("total_cases >= 0"),
        CheckConstraint("pass_count >= 0"),
        CheckConstraint("fail_count >= 0"),
        CheckConstraint("error_count >= 0"),
        CheckConstraint("status IN ('CREATED', 'RUNNING', 'COMPLETED', 'FAILED')"),
    )


class EvaluationResult(Base):
    __tablename__ = "evaluation_results"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    experiment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("experiments.id", ondelete="RESTRICT"),
        nullable=False,
    )
    dataset_version_case_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("dataset_version_cases.id", ondelete="RESTRICT"),
        nullable=False,
    )
    _json_type = JSON().with_variant(postgresql.JSONB(), "postgresql")
    input_snapshot: Mapped[dict] = mapped_column(_json_type, nullable=False)
    output_snapshot: Mapped[dict] = mapped_column(_json_type, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    reason_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    __table_args__ = (
        UniqueConstraint("experiment_id", "dataset_version_case_id", name="uq_evaluation_results_experiment_case"),
        CheckConstraint("status IN ('PASS', 'FAIL', 'ERROR')"),
    )
