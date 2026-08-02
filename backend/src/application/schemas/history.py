from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from src.application.schemas.common import ListMeta


class QualityGateHistoryItemResponse(BaseModel):
    result_id: UUID
    policy_id: UUID
    status: Literal["PASS", "BLOCK"]
    pass_rate: Decimal
    reason_codes: list[str]
    created_at: datetime


class BaselineComparisonHistoryItemResponse(BaseModel):
    comparison_id: UUID
    baseline_experiment_id: UUID
    current_experiment_id: UUID
    status: Literal["IMPROVED", "UNCHANGED", "REGRESSED"]
    pass_rate_delta: Decimal
    reason_codes: list[str]
    created_at: datetime


class ExperimentHistoryItemResponse(BaseModel):
    experiment_id: UUID
    dataset_version_id: UUID
    target_version_id: UUID
    evaluator_version_id: UUID
    experiment_status: Literal["CREATED", "RUNNING", "COMPLETED", "FAILED"]
    total_case_count: int
    passed_case_count: int
    failed_case_count: int
    error_case_count: int
    pass_rate: Decimal | None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None
    quality_gate_result: QualityGateHistoryItemResponse | None
    baseline_comparison: BaselineComparisonHistoryItemResponse | None


class ExperimentHistoryListResponse(BaseModel):
    data: list[ExperimentHistoryItemResponse]
    meta: ListMeta


class TrendSummaryResponse(BaseModel):
    project_id: UUID
    created_from: datetime | None
    created_to: datetime | None
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
    latest_experiment: ExperimentHistoryItemResponse | None
    latest_quality_gate_result: QualityGateHistoryItemResponse | None
    latest_baseline_comparison: BaselineComparisonHistoryItemResponse | None
