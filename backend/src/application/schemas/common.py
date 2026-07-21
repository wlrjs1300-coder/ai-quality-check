from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class RequestMetadata(BaseModel):
    request_id: str


class PaginationMeta(BaseModel):
    total: int
    page: int
    size: int


class ListMeta(BaseModel):
    request_id: str
    pagination: PaginationMeta


class BaseListResponse(BaseModel):
    data: list[Any]
    meta: ListMeta


class ErrorResponse(BaseModel):
    error: dict[str, str | int | None]
