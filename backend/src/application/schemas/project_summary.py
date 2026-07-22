from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from src.application.schemas.history import (
    BaselineComparisonHistoryItemResponse,
    ExperimentHistoryItemResponse,
    QualityGateHistoryItemResponse,
)


class ProjectSummaryProjectItem(BaseModel):
    project_id: UUID
    slug: str
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProjectSummaryPeriodItem(BaseModel):
    created_from: datetime | None
    created_to: datetime | None


class ProjectSummaryReadinessItem(BaseModel):
    status: Literal["READY", "NOT_READY", "UNKNOWN"]
    reason_codes: list[str]
    reason_summary: str


class ProjectSummaryMetricsItem(BaseModel):
    experiment_count: int
    pending_experiment_count: int
    running_experiment_count: int
    completed_experiment_count: int
    failed_experiment_count: int
    average_pass_rate: Decimal | None
    first_pass_rate: Decimal | None
    latest_pass_rate: Decimal | None
    pass_rate_delta: Decimal | None
    gate_pass_count: int
    gate_block_count: int
    gate_missing_count: int
    comparison_improved_count: int
    comparison_unchanged_count: int
    comparison_regressed_count: int
    comparison_missing_count: int


class ProjectSummaryReportResponse(BaseModel):
    project: ProjectSummaryProjectItem
    period: ProjectSummaryPeriodItem
    readiness: ProjectSummaryReadinessItem
    summary: str
    metrics: ProjectSummaryMetricsItem
    latest_experiment: ExperimentHistoryItemResponse | None
    latest_quality_gate_result: QualityGateHistoryItemResponse | None
    latest_baseline_comparison: BaselineComparisonHistoryItemResponse | None
    warning_codes: list[str]
