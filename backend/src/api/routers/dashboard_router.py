from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import ProjectDashboardOverviewResponse
from src.application.services import ProjectDashboardOverviewService

router = APIRouter(prefix="/projects", tags=["dashboard"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


@router.get("/{project_id}/dashboard-overview")
async def get_project_dashboard_overview(
    request: Request,
    project_id: UUID,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    overview = ProjectDashboardOverviewResponse(
        **await ProjectDashboardOverviewService(db).get_overview(
            project_id,
            created_from,
            created_to,
        )
    )
    return {"data": overview.model_dump(), "meta": {"request_id": _request_id(request)}}
