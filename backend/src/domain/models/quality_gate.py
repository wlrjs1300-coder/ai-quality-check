from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column

from src.domain.models.base import Base, TimestampMixin


class QualityGatePolicy(Base, TimestampMixin):
    __tablename__ = "quality_gate_policies"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    minimum_pass_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    block_on_error: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    block_on_required_case_failure: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_quality_gate_policies_project_name"),
        CheckConstraint("length(trim(name)) > 0", name="ck_quality_gate_policies_name_not_blank"),
        CheckConstraint(
            "minimum_pass_rate >= 0 AND minimum_pass_rate <= 1",
            name="ck_quality_gate_policies_minimum_pass_rate",
        ),
    )


class QualityGateResult(Base):
    __tablename__ = "quality_gate_results"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("quality_gate_policies.id", ondelete="RESTRICT"),
        nullable=False,
    )
    experiment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("experiments.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    pass_rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    total_case_count: Mapped[int] = mapped_column(Integer, nullable=False)
    passed_case_count: Mapped[int] = mapped_column(Integer, nullable=False)
    failed_case_count: Mapped[int] = mapped_column(Integer, nullable=False)
    error_case_count: Mapped[int] = mapped_column(Integer, nullable=False)
    required_case_failure_count: Mapped[int] = mapped_column(Integer, nullable=False)
    _json_type = JSON().with_variant(postgresql.JSONB(), "postgresql")
    reason_codes: Mapped[list[str]] = mapped_column(_json_type, nullable=False, default=list)
    reason_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("policy_id", "experiment_id", name="uq_quality_gate_results_policy_experiment"),
        CheckConstraint("status IN ('PASS', 'BLOCK')", name="ck_quality_gate_results_status"),
        CheckConstraint("pass_rate >= 0 AND pass_rate <= 1", name="ck_quality_gate_results_pass_rate"),
        CheckConstraint("total_case_count >= 0", name="ck_quality_gate_results_total_count"),
        CheckConstraint("passed_case_count >= 0", name="ck_quality_gate_results_passed_count"),
        CheckConstraint("failed_case_count >= 0", name="ck_quality_gate_results_failed_count"),
        CheckConstraint("error_case_count >= 0", name="ck_quality_gate_results_error_count"),
        CheckConstraint(
            "required_case_failure_count >= 0",
            name="ck_quality_gate_results_required_failure_count",
        ),
        CheckConstraint(
            "passed_case_count + failed_case_count + error_case_count = total_case_count",
            name="ck_quality_gate_results_count_consistency",
        ),
    )
