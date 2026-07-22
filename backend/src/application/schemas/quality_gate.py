from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class QualityGatePolicyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    minimum_pass_rate: Decimal = Field(ge=Decimal("0"), le=Decimal("1"))
    block_on_error: bool = True
    block_on_required_case_failure: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("name must not be blank")
        return value.strip()


class QualityGatePolicyResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    minimum_pass_rate: Decimal
    block_on_error: bool
    block_on_required_case_failure: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class QualityGateEvaluateRequest(BaseModel):
    experiment_id: UUID


class QualityGateResultResponse(BaseModel):
    id: UUID
    policy_id: UUID
    experiment_id: UUID
    status: Literal["PASS", "BLOCK"]
    pass_rate: Decimal
    total_case_count: int
    passed_case_count: int
    failed_case_count: int
    error_case_count: int
    required_case_failure_count: int
    reason_codes: list[str]
    reason_summary: str | None
    created_at: datetime
