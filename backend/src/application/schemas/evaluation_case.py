from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from src.domain.models.enums import CaseSeverity, CaseStatus


class EvaluationCaseCreateRequest(BaseModel):
    case_key: str = Field(..., min_length=1, max_length=120)
    question: str = Field(..., min_length=1)
    expected_summary: str | None = None
    evidence: list[dict] = Field(default_factory=list)
    required_elements: list[dict] = Field(default_factory=list)
    forbidden_elements: list[dict] = Field(default_factory=list)
    tags: list[dict] = Field(default_factory=list)
    severity: CaseSeverity = CaseSeverity.MEDIUM
    required_for_release: bool = False


class EvaluationCaseUpdateRequest(BaseModel):
    question: str | None = Field(default=None, min_length=1)
    expected_summary: str | None = None
    evidence: list[dict] | None = None
    required_elements: list[dict] | None = None
    forbidden_elements: list[dict] | None = None
    tags: list[dict] | None = None
    severity: CaseSeverity | None = None
    required_for_release: bool | None = None


class EvaluationCaseResponse(BaseModel):
    id: UUID
    dataset_id: UUID
    case_key: str
    question: str
    expected_summary: str | None = None
    evidence: list[dict] | list
    required_elements: list[dict] | list
    forbidden_elements: list[dict] | list
    tags: list[dict] | list
    severity: str
    required_for_release: bool
    status: CaseStatus
