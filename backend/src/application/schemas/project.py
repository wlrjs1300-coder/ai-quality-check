from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class ProjectCreateRequest(BaseModel):
    slug: str = Field(..., min_length=1, max_length=120)
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = None


class ProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    is_active: bool | None = None


class ProjectResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str | None = None
    is_active: bool
