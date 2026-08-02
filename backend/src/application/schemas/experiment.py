from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ExperimentCreateRequest(BaseModel):
    dataset_version_id: UUID
    target_version_id: UUID
    evaluator_version_id: UUID


class ExperimentResponse(BaseModel):
    id: UUID
    dataset_version_id: UUID
    target_version_id: UUID
    evaluator_version_id: UUID
    status: str
    total_cases: int
    pass_count: int
    fail_count: int
    error_count: int
    completed_at: datetime | None = None
    error_code: str | None = None
    error_message: str | None = None


class ExperimentResultResponse(BaseModel):
    id: UUID
    experiment_id: UUID
    dataset_version_case_id: UUID
    input_snapshot: dict | list | str | int | float | bool | None = None
    output_snapshot: dict | list | str | int | float | bool | None = None
    status: str = Field(pattern="^(PASS|FAIL|ERROR)$")
    reason_code: str | None = None
    reason: str | None = None
    created_at: datetime


class ExperimentRunResponse(ExperimentResponse):
    pass
