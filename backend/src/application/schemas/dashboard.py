from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from src.application.schemas.history import (
    BaselineComparisonHistoryItemResponse,
    QualityGateHistoryItemResponse,
)
from src.application.schemas.project_summary import (
    ProjectSummaryPeriodItem,
    ProjectSummaryProjectItem,
    ProjectSummaryReadinessItem,
)


class ProjectDashboardKpiItem(BaseModel):
    experiment_count: int
    completed_experiment_count: int
    failed_experiment_count: int
    running_experiment_count: int
    latest_pass_rate: Decimal | None
    average_pass_rate: Decimal | None
    pass_rate_delta: Decimal | None
    gate_pass_count: int
    gate_block_count: int
    comparison_regressed_count: int


class ProjectDashboardTrendItem(BaseModel):
    direction: Literal["IMPROVING", "STABLE", "DECLINING", "UNKNOWN"]
    first_pass_rate: Decimal | None
    latest_pass_rate: Decimal | None
    pass_rate_delta: Decimal | None
    summary: str


class DashboardRecentExperimentItem(BaseModel):
    experiment_id: UUID
    experiment_status: Literal["CREATED", "RUNNING", "COMPLETED", "FAILED"]
    pass_rate: Decimal | None
    total_case_count: int
    passed_case_count: int
    failed_case_count: int
    error_case_count: int
    created_at: datetime
    completed_at: datetime | None
    quality_gate_status: Literal["PASS", "BLOCK"] | None
    baseline_comparison_status: Literal["IMPROVED", "UNCHANGED", "REGRESSED"] | None


class ProjectDashboardOverviewResponse(BaseModel):
    project: ProjectSummaryProjectItem
    period: ProjectSummaryPeriodItem
    readiness: ProjectSummaryReadinessItem
    kpis: ProjectDashboardKpiItem
    recent_experiments: list[DashboardRecentExperimentItem]
    latest_quality_gate_result: QualityGateHistoryItemResponse | None
    latest_baseline_comparison: BaselineComparisonHistoryItemResponse | None
    trend: ProjectDashboardTrendItem
    warning_codes: list[str]
