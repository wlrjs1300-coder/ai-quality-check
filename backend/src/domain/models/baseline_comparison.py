from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column

from src.domain.models.base import Base


class BaselineComparison(Base):
    __tablename__ = "baseline_comparisons"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False
    )
    baseline_experiment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("experiments.id", ondelete="RESTRICT"), nullable=False
    )
    current_experiment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("experiments.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    total_case_count: Mapped[int] = mapped_column(Integer, nullable=False)
    improved_case_count: Mapped[int] = mapped_column(Integer, nullable=False)
    unchanged_case_count: Mapped[int] = mapped_column(Integer, nullable=False)
    regressed_case_count: Mapped[int] = mapped_column(Integer, nullable=False)
    baseline_passed_case_count: Mapped[int] = mapped_column(Integer, nullable=False)
    current_passed_case_count: Mapped[int] = mapped_column(Integer, nullable=False)
    pass_rate_delta: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)
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
        UniqueConstraint(
            "baseline_experiment_id",
            "current_experiment_id",
            name="uq_baseline_comparisons_experiment_pair",
        ),
        CheckConstraint("baseline_experiment_id <> current_experiment_id", name="ck_baseline_comparisons_distinct"),
        CheckConstraint("status IN ('IMPROVED', 'UNCHANGED', 'REGRESSED')", name="ck_baseline_comparisons_status"),
        CheckConstraint("total_case_count > 0", name="ck_baseline_comparisons_total_count"),
        CheckConstraint("improved_case_count >= 0", name="ck_baseline_comparisons_improved_count"),
        CheckConstraint("unchanged_case_count >= 0", name="ck_baseline_comparisons_unchanged_count"),
        CheckConstraint("regressed_case_count >= 0", name="ck_baseline_comparisons_regressed_count"),
        CheckConstraint("baseline_passed_case_count >= 0", name="ck_baseline_comparisons_baseline_passed_count"),
        CheckConstraint("current_passed_case_count >= 0", name="ck_baseline_comparisons_current_passed_count"),
        CheckConstraint(
            "improved_case_count + unchanged_case_count + regressed_case_count = total_case_count",
            name="ck_baseline_comparisons_count_consistency",
        ),
        CheckConstraint("pass_rate_delta >= -1 AND pass_rate_delta <= 1", name="ck_baseline_comparisons_pass_rate_delta"),
    )


class BaselineComparisonCase(Base):
    __tablename__ = "baseline_comparison_cases"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comparison_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("baseline_comparisons.id", ondelete="RESTRICT"), nullable=False
    )
    dataset_version_case_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("dataset_version_cases.id", ondelete="RESTRICT"), nullable=False
    )
    case_key: Mapped[str] = mapped_column(String(120), nullable=False)
    baseline_status: Mapped[str] = mapped_column(String(16), nullable=False)
    current_status: Mapped[str] = mapped_column(String(16), nullable=False)
    change_status: Mapped[str] = mapped_column(String(16), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "comparison_id",
            "dataset_version_case_id",
            name="uq_baseline_comparison_cases_comparison_case",
        ),
        CheckConstraint("baseline_status IN ('PASS', 'FAIL', 'ERROR')", name="ck_baseline_comparison_cases_baseline_status"),
        CheckConstraint("current_status IN ('PASS', 'FAIL', 'ERROR')", name="ck_baseline_comparison_cases_current_status"),
        CheckConstraint(
            "change_status IN ('IMPROVED', 'UNCHANGED', 'REGRESSED')",
            name="ck_baseline_comparison_cases_change_status",
        ),
    )
