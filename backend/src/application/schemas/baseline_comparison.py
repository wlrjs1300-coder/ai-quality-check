from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class BaselineComparisonCreateRequest(BaseModel):
    baseline_experiment_id: UUID
    current_experiment_id: UUID


class BaselineComparisonResponse(BaseModel):
    id: UUID
    project_id: UUID
    baseline_experiment_id: UUID
    current_experiment_id: UUID
    status: Literal["IMPROVED", "UNCHANGED", "REGRESSED"]
    total_case_count: int
    improved_case_count: int
    unchanged_case_count: int
    regressed_case_count: int
    baseline_passed_case_count: int
    current_passed_case_count: int
    pass_rate_delta: Decimal
    reason_codes: list[str]
    reason_summary: str | None
    created_at: datetime


class BaselineComparisonCaseResponse(BaseModel):
    id: UUID
    comparison_id: UUID
    dataset_version_case_id: UUID
    case_key: str
    baseline_status: Literal["PASS", "FAIL", "ERROR"]
    current_status: Literal["PASS", "FAIL", "ERROR"]
    change_status: Literal["IMPROVED", "UNCHANGED", "REGRESSED"]
    reason_code: str
    created_at: datetime
