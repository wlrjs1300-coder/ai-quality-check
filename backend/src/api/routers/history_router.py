from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import (
    ExperimentHistoryItemResponse,
    ExperimentHistoryListResponse,
    ListMeta,
    PaginationMeta,
    TrendSummaryResponse,
)
from src.application.services import HistoryService

router = APIRouter(prefix="/projects", tags=["history"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


@router.get("/{project_id}/experiment-history")
async def list_experiment_history(
    request: Request,
    project_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    experiment_status: Literal["CREATED", "RUNNING", "COMPLETED", "FAILED"] | None = None,
    gate_status: Literal["PASS", "BLOCK"] | None = None,
    comparison_status: Literal["IMPROVED", "UNCHANGED", "REGRESSED"] | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    sort: Literal["created_at_desc", "created_at_asc"] = "created_at_desc",
    db: AsyncSession = Depends(get_db_session),
) -> ExperimentHistoryListResponse:
    items, total = await HistoryService(db).list_history(
        project_id=project_id,
        page=page,
        size=size,
        experiment_status=experiment_status,
        gate_status=gate_status,
        comparison_status=comparison_status,
        created_from=created_from,
        created_to=created_to,
        sort=sort,
    )
    return ExperimentHistoryListResponse(
        data=[ExperimentHistoryItemResponse(**item) for item in items],
        meta=ListMeta(
            request_id=_request_id(request),
            pagination=PaginationMeta(total=total, page=page, size=size),
        ),
    )


@router.get("/{project_id}/trend-summary")
async def get_trend_summary(
    request: Request,
    project_id: UUID,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    summary = TrendSummaryResponse(
        **await HistoryService(db).trend_summary(project_id, created_from, created_to)
    )
    return {"data": summary.model_dump(), "meta": {"request_id": _request_id(request)}}
