from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DatasetVersionCaseResponse(BaseModel):
    id: UUID
    source_evaluation_case_id: UUID
    case_key: str
    question: str
    expected_summary: str | None = None
    evidence: list[dict] | list
    required_elements: list[dict] | list
    forbidden_elements: list[dict] | list
    tags: list[dict] | list
    severity: str
    required_for_release: bool


class DatasetVersionResponse(BaseModel):
    id: UUID
    dataset_id: UUID
    version: int
    content_hash: str
    case_count: int
    created_at: datetime
    cases: list[DatasetVersionCaseResponse] | None = None


class DatasetVersionListItem(BaseModel):
    id: UUID
    dataset_id: UUID
    version: int
    content_hash: str
    case_count: int
    created_at: datetime
