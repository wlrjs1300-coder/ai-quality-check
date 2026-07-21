from __future__ import annotations

from uuid import UUID
from datetime import datetime

from typing import Literal
from pydantic import BaseModel, Field


class TargetCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    target_type: Literal["MOCK"] = Field(default="MOCK")
    config: dict = Field(default_factory=dict)


class TargetUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    config: dict | None = None
    is_active: bool | None = None


class TargetResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    target_type: Literal["MOCK"]
    config: dict
    is_active: bool


class TargetVersionResponse(BaseModel):
    id: UUID
    target_id: UUID
    version: int
    content_hash: str
    created_at: datetime
    config_snapshot: dict
    response_strategy: Literal["FIXED", "CASE_BASED", "SCENARIO_BASED"] = "FIXED"
    latency_ms: int = Field(default=0, ge=0)
    failure_rate: float = Field(default=0.0, ge=0.0, le=1.0)
