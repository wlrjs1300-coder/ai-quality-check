from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import (
    BaseListResponse,
    ListMeta,
    PaginationMeta,
    ProjectCreateRequest,
    ProjectResponse,
    ProjectUpdateRequest,
)
from src.application.services import ProjectService
from src.domain.models import Project

router = APIRouter(prefix="/projects", tags=["projects"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


def _project_to_dict(project: Project) -> dict:
    return {
        "id": str(project.id),
        "slug": project.slug,
        "name": project.name,
        "description": project.description,
        "is_active": project.is_active,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


@router.post("", status_code=201)
async def create_project(
    request: Request,
    payload: ProjectCreateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = ProjectService(db)
    project = await service.create_project(payload)
    return {
        "data": ProjectResponse(**_project_to_dict(project)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.get("")
async def list_projects(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BaseListResponse:
    service = ProjectService(db)
    projects, total = await service.list_projects(page=page, size=size)
    return BaseListResponse(
        data=[_project_to_dict(item) for item in projects],
        meta=ListMeta(request_id=_request_id(request), pagination=PaginationMeta(total=total, page=page, size=size)),
    )


@router.get("/{project_id}")
async def get_project(
    request: Request,
    project_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = ProjectService(db)
    project = await service.get_project(project_id)
    return {
        "data": ProjectResponse(**_project_to_dict(project)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.patch("/{project_id}")
async def update_project(
    request: Request,
    project_id: UUID,
    payload: ProjectUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = ProjectService(db)
    project = await service.update_project(project_id, payload)
    return {
        "data": ProjectResponse(**_project_to_dict(project)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }
