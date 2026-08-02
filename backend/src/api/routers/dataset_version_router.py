from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import (
    BaseListResponse,
    DatasetVersionListItem,
    DatasetVersionResponse,
    ListMeta,
    PaginationMeta,
)
from src.application.services import DatasetVersionService
from src.domain.models import DatasetVersion, DatasetVersionCase


router = APIRouter(tags=["dataset-versions"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


def _case_to_dict(case: DatasetVersionCase) -> dict:
    return {
        "id": str(case.id),
        "source_evaluation_case_id": str(case.source_evaluation_case_id),
        "case_key": case.case_key,
        "question": case.question,
        "expected_summary": case.expected_summary,
        "evidence": case.evidence,
        "required_elements": case.required_elements,
        "forbidden_elements": case.forbidden_elements,
        "tags": case.tags,
        "severity": case.severity,
        "required_for_release": case.required_for_release,
    }


def _version_to_dict(version: DatasetVersion, include_cases: bool = False, cases: list[DatasetVersionCase] | None = None) -> dict:
    response: dict[str, object] = {
        "id": str(version.id),
        "dataset_id": str(version.dataset_id),
        "version": version.version,
        "content_hash": version.content_hash,
        "case_count": version.case_count,
        "created_at": version.created_at,
    }
    if include_cases and cases is not None:
        response["cases"] = [_case_to_dict(case) for case in cases]
    return response


@router.post("/datasets/{dataset_id}/versions", status_code=201)
async def create_dataset_version(
    request: Request,
    dataset_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = DatasetVersionService(db)
    version = await service.create_version(dataset_id)
    return {
        "data": DatasetVersionResponse(**_version_to_dict(version)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.get("/datasets/{dataset_id}/versions")
async def list_dataset_versions(
    request: Request,
    dataset_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BaseListResponse:
    service = DatasetVersionService(db)
    versions = await service.list_versions(dataset_id)
    total = len(versions)
    offset = (page - 1) * size
    paginated = versions[offset : offset + size]
    return BaseListResponse(
        data=[DatasetVersionListItem(**_version_to_dict(item)).model_dump() for item in paginated],
        meta=ListMeta(request_id=_request_id(request), pagination=PaginationMeta(total=total, page=page, size=size)),
    )


@router.get("/datasets/{dataset_id}/versions/{version}")
async def get_dataset_version(
    request: Request,
    dataset_id: UUID,
    version: int,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = DatasetVersionService(db)
    dataset_version, cases = await service.get_version(dataset_id, version)
    return {
        "data": DatasetVersionResponse(**_version_to_dict(dataset_version, include_cases=True, cases=cases)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }
