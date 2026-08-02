from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import (
    BaseListResponse,
    EvaluationCaseCreateRequest,
    EvaluationCaseResponse,
    EvaluationCaseUpdateRequest,
    ListMeta,
    PaginationMeta,
)
from src.application.services import EvaluationCaseService
from src.domain.models import EvaluationCase

router = APIRouter(tags=["evaluation-cases"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


def _case_to_dict(case: EvaluationCase) -> dict:
    return {
        "id": str(case.id),
        "dataset_id": str(case.dataset_id),
        "case_key": case.case_key,
        "question": case.question,
        "expected_summary": case.expected_summary,
        "evidence": case.evidence,
        "required_elements": case.required_elements,
        "forbidden_elements": case.forbidden_elements,
        "tags": case.tags,
        "severity": case.severity,
        "required_for_release": case.required_for_release,
        "status": case.status,
        "created_at": case.created_at,
        "updated_at": case.updated_at,
    }


@router.post("/datasets/{dataset_id}/evaluation-cases", status_code=201)
async def create_evaluation_case(
    request: Request,
    dataset_id: UUID,
    payload: EvaluationCaseCreateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluationCaseService(db)
    case = await service.create_case(dataset_id, payload)
    return {
        "data": EvaluationCaseResponse(**_case_to_dict(case)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.get("/datasets/{dataset_id}/evaluation-cases")
async def list_evaluation_cases(
    request: Request,
    dataset_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BaseListResponse:
    service = EvaluationCaseService(db)
    cases, total = await service.list_cases(dataset_id, page=page, size=size)
    return BaseListResponse(
        data=[_case_to_dict(item) for item in cases],
        meta=ListMeta(request_id=_request_id(request), pagination=PaginationMeta(total=total, page=page, size=size)),
    )


@router.get("/evaluation-cases/{case_id}")
async def get_evaluation_case(
    request: Request,
    case_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluationCaseService(db)
    case = await service.get_case(case_id)
    return {
        "data": EvaluationCaseResponse(**_case_to_dict(case)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.patch("/evaluation-cases/{case_id}")
async def update_evaluation_case(
    request: Request,
    case_id: UUID,
    payload: EvaluationCaseUpdateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluationCaseService(db)
    case = await service.update_case(case_id, payload)
    return {
        "data": EvaluationCaseResponse(**_case_to_dict(case)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.post("/evaluation-cases/{case_id}/approve")
async def approve_evaluation_case(
    request: Request,
    case_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluationCaseService(db)
    case = await service.approve_case(case_id)
    return {
        "data": EvaluationCaseResponse(**_case_to_dict(case)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }


@router.post("/evaluation-cases/{case_id}/deprecate")
async def deprecate_evaluation_case(
    request: Request,
    case_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = EvaluationCaseService(db)
    case = await service.deprecate_case(case_id)
    return {
        "data": EvaluationCaseResponse(**_case_to_dict(case)).model_dump(),
        "meta": {"request_id": _request_id(request)},
    }
