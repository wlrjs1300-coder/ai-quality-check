from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import (
    BaseListResponse,
    EvaluatorCreateRequest,
    EvaluatorResponse,
    EvaluatorVersionExecuteRequest,
    EvaluatorVersionExecuteResponse,
    EvaluatorUpdateRequest,
    EvaluatorVersionResponse,
    ListMeta,
    PaginationMeta,
)
from src.application.services import EvaluatorService

router = APIRouter(tags=["evaluators"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


def _evaluator_to_dict(evaluator):
    return {
        "id": str(evaluator.id),
        "project_id": str(evaluator.project_id),
        "name": evaluator.name,
        "evaluator_type": evaluator.evaluator_type,
        "config": evaluator.config,
        "is_active": evaluator.is_active,
        "created_at": evaluator.created_at,
        "updated_at": evaluator.updated_at,
    }


def _version_to_dict(version):
    return {
        "id": str(version.id),
        "evaluator_id": str(version.evaluator_id),
        "version": version.version,
        "content_hash": version.content_hash,
        "evaluator_type_snapshot": version.evaluator_type_snapshot,
        "config_snapshot": version.config_snapshot,
        "created_at": version.created_at,
    }


@router.post("/projects/{project_id}/evaluators", status_code=201)
async def create_evaluator(
    request: Request,
    project_id: UUID,
    payload: EvaluatorCreateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluatorService(db)
    evaluator = await service.create_evaluator(project_id, payload)
    return {
        "data": EvaluatorResponse(**_evaluator_to_dict(evaluator)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.get("/projects/{project_id}/evaluators")
async def list_evaluators(
    request: Request,
    project_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BaseListResponse:
    service = EvaluatorService(db)
    evaluators = await service.list_evaluators(project_id)
    total = len(evaluators)
    offset = (page - 1) * size
    return BaseListResponse(
        data=[_evaluator_to_dict(item) for item in evaluators[offset : offset + size]],
        meta=ListMeta(request_id=_request_id(request), pagination=PaginationMeta(total=total, page=page, size=size)),
    )


@router.get("/evaluators/{evaluator_id}")
async def get_evaluator(
    request: Request,
    evaluator_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluatorService(db)
    evaluator = await service.get_evaluator(evaluator_id)
    return {
        "data": EvaluatorResponse(**_evaluator_to_dict(evaluator)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.patch("/evaluators/{evaluator_id}")
async def update_evaluator(
    request: Request,
    evaluator_id: UUID,
    payload: EvaluatorUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluatorService(db)
    evaluator = await service.update_evaluator(evaluator_id, payload)
    return {
        "data": EvaluatorResponse(**_evaluator_to_dict(evaluator)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.post("/evaluators/{evaluator_id}/versions", status_code=201)
async def create_evaluator_version(
    request: Request,
    evaluator_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluatorService(db)
    version = await service.create_version(evaluator_id)
    return {
        "data": EvaluatorVersionResponse(**_version_to_dict(version)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.get("/evaluators/{evaluator_id}/versions")
async def list_evaluator_versions(
    request: Request,
    evaluator_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BaseListResponse:
    service = EvaluatorService(db)
    versions = await service.list_versions(evaluator_id)
    total = len(versions)
    offset = (page - 1) * size
    return BaseListResponse(
        data=[_version_to_dict(item) for item in versions[offset : offset + size]],
        meta=ListMeta(request_id=_request_id(request), pagination=PaginationMeta(total=total, page=page, size=size)),
    )


@router.get("/evaluators/{evaluator_id}/versions/{version}")
async def get_evaluator_version(
    request: Request,
    evaluator_id: UUID,
    version: int,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluatorService(db)
    evaluator_version = await service.get_version(evaluator_id, version)
    return {
        "data": EvaluatorVersionResponse(**_version_to_dict(evaluator_version)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.get("/evaluator-versions/{version_id}")
async def get_evaluator_version_by_id(
    request: Request,
    version_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluatorService(db)
    evaluator_version = await service.get_version_by_id(version_id)
    return {
        "data": EvaluatorVersionResponse(**_version_to_dict(evaluator_version)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.post("/evaluator-versions/{version_id}/execute")
async def execute_evaluator_version(
    request: Request,
    version_id: UUID,
    payload: EvaluatorVersionExecuteRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluatorService(db)
    result = await service.execute_version(version_id, payload.output.model_dump())
    response = EvaluatorVersionExecuteResponse(**result)
    return {
        "data": response.model_dump(),
        "meta": {"request_id": _request_id(request)},
    }
