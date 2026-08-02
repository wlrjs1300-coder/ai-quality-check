from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import (
    BaseListResponse,
    DatasetCreateRequest,
    DatasetResponse,
    DatasetUpdateRequest,
    ListMeta,
    PaginationMeta,
)
from src.application.services import DatasetService
from src.domain.models import Dataset

router = APIRouter(tags=["datasets"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


def _dataset_to_dict(dataset: Dataset) -> dict:
    return {
        "id": str(dataset.id),
        "project_id": str(dataset.project_id),
        "name": dataset.name,
        "description": dataset.description,
        "is_active": dataset.is_active,
        "created_at": dataset.created_at,
        "updated_at": dataset.updated_at,
    }


@router.post("/projects/{project_id}/datasets", status_code=201)
async def create_dataset(
    request: Request,
    project_id: UUID,
    payload: DatasetCreateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = DatasetService(db)
    dataset = await service.create_dataset(project_id, payload)
    return {
        "data": DatasetResponse(**_dataset_to_dict(dataset)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.get("/projects/{project_id}/datasets")
async def list_datasets(
    request: Request,
    project_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BaseListResponse:
    service = DatasetService(db)
    datasets, total = await service.list_datasets(project_id, page=page, size=size)
    return BaseListResponse(
        data=[_dataset_to_dict(item) for item in datasets],
        meta=ListMeta(request_id=_request_id(request), pagination=PaginationMeta(total=total, page=page, size=size)),
    )


@router.get("/datasets/{dataset_id}")
async def get_dataset(
    request: Request,
    dataset_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = DatasetService(db)
    dataset = await service.get_dataset(dataset_id)
    return {
        "data": DatasetResponse(**_dataset_to_dict(dataset)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.patch("/datasets/{dataset_id}")
async def update_dataset(
    request: Request,
    dataset_id: UUID,
    payload: DatasetUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = DatasetService(db)
    dataset = await service.update_dataset(dataset_id, payload)
    return {
        "data": DatasetResponse(**_dataset_to_dict(dataset)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }
