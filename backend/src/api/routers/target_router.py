from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import (
    BaseListResponse,
    ListMeta,
    PaginationMeta,
    TargetCreateRequest,
    TargetResponse,
    TargetUpdateRequest,
    TargetVersionResponse,
)
from src.application.services import TargetService

router = APIRouter(tags=["targets"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


def _target_to_dict(target):
    return {
        "id": str(target.id),
        "project_id": str(target.project_id),
        "name": target.name,
        "target_type": target.target_type,
        "config": target.config,
        "is_active": target.is_active,
    }


def _version_to_dict(version):
    return {
        "id": str(version.id),
        "target_id": str(version.target_id),
        "version": version.version,
        "content_hash": version.content_hash,
        "created_at": version.created_at,
        "config_snapshot": version.config_snapshot,
        "response_strategy": version.response_strategy,
        "latency_ms": version.latency_ms,
        "failure_rate": version.failure_rate,
    }


@router.post("/projects/{project_id}/targets", status_code=201)
async def create_target(
    request: Request,
    project_id: UUID,
    payload: TargetCreateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = TargetService(db)
    target = await service.create_target(project_id, payload)
    return {
        "data": TargetResponse(**_target_to_dict(target)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.get("/projects/{project_id}/targets")
async def list_targets(
    request: Request,
    project_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BaseListResponse:
    service = TargetService(db)
    targets = await service.list_targets(project_id)
    total = len(targets)
    offset = (page - 1) * size
    return BaseListResponse(
        data=[_target_to_dict(item) for item in targets[offset : offset + size]],
        meta=ListMeta(request_id=_request_id(request), pagination=PaginationMeta(total=total, page=page, size=size)),
    )


@router.get("/targets/{target_id}")
async def get_target(
    request: Request,
    target_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = TargetService(db)
    target = await service.get_target(target_id)
    return {
        "data": TargetResponse(**_target_to_dict(target)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.patch("/targets/{target_id}")
async def update_target(
    request: Request,
    target_id: UUID,
    payload: TargetUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = TargetService(db)
    target = await service.update_target(target_id, payload)
    return {
        "data": TargetResponse(**_target_to_dict(target)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.post("/targets/{target_id}/versions", status_code=201)
async def create_target_version(
    request: Request,
    target_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = TargetService(db)
    version = await service.create_version(target_id)
    return {
        "data": TargetVersionResponse(**_version_to_dict(version)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.get("/targets/{target_id}/versions")
async def list_target_versions(
    request: Request,
    target_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BaseListResponse:
    service = TargetService(db)
    versions = await service.list_versions(target_id)
    total = len(versions)
    offset = (page - 1) * size
    return BaseListResponse(
        data=[_version_to_dict(item) for item in versions[offset : offset + size]],
        meta=ListMeta(request_id=_request_id(request), pagination=PaginationMeta(total=total, page=page, size=size)),
    )


@router.get("/targets/{target_id}/versions/{version}")
async def get_target_version(
    request: Request,
    target_id: UUID,
    version: int,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = TargetService(db)
    target_version = await service.get_version(target_id, version)
    return {
        "data": TargetVersionResponse(**_version_to_dict(target_version)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.get("/target-versions/{version_id}")
async def get_target_version_by_id(
    request: Request,
    version_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = TargetService(db)
    target_version = await service.get_version_by_id(version_id)
    return {
        "data": TargetVersionResponse(**_version_to_dict(target_version)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }
