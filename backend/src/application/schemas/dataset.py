from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class DatasetCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=180)
    description: str | None = None


class DatasetUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = None
    is_active: bool | None = None


class DatasetResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: str | None = None
    is_active: bool
