from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class EvaluatorCreateRequest(BaseModel):
    name: str
    evaluator_type: Literal["CONTAINS", "NOT_CONTAINS", "REGEX"]
    config: dict


class EvaluatorUpdateRequest(BaseModel):
    name: str | None = None
    config: dict | None = None
    is_active: bool | None = None


class EvaluatorResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    evaluator_type: Literal["CONTAINS", "NOT_CONTAINS", "REGEX"]
    config: dict
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EvaluatorVersionResponse(BaseModel):
    id: UUID
    evaluator_id: UUID
    version: int
    content_hash: str
    evaluator_type_snapshot: Literal["CONTAINS", "NOT_CONTAINS", "REGEX"]
    config_snapshot: dict
    created_at: datetime


class EvaluatorVersionExecuteRequest(BaseModel):
    class Output(BaseModel):
        text: str

    output: Output


class EvaluatorVersionExecuteResponse(BaseModel):
    evaluator_version_id: UUID
    evaluator_type: Literal["CONTAINS", "NOT_CONTAINS", "REGEX"]
    status: Literal["PASS", "FAIL"]
    reason_code: str | None = None
    reason: str | None = None
