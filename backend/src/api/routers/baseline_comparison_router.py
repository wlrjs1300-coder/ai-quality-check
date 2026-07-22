from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import (
    BaseListResponse,
    BaselineComparisonCaseResponse,
    BaselineComparisonCreateRequest,
    BaselineComparisonResponse,
    ListMeta,
    PaginationMeta,
)
from src.application.services import BaselineComparisonService
from src.domain.models import BaselineComparison, BaselineComparisonCase

router = APIRouter(prefix="/baseline-comparisons", tags=["baseline-comparisons"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


def _comparison_response(comparison: BaselineComparison) -> BaselineComparisonResponse:
    return BaselineComparisonResponse(
        id=comparison.id,
        project_id=comparison.project_id,
        baseline_experiment_id=comparison.baseline_experiment_id,
        current_experiment_id=comparison.current_experiment_id,
        status=comparison.status,
        total_case_count=comparison.total_case_count,
        improved_case_count=comparison.improved_case_count,
        unchanged_case_count=comparison.unchanged_case_count,
        regressed_case_count=comparison.regressed_case_count,
        baseline_passed_case_count=comparison.baseline_passed_case_count,
        current_passed_case_count=comparison.current_passed_case_count,
        pass_rate_delta=comparison.pass_rate_delta,
        reason_codes=comparison.reason_codes,
        reason_summary=comparison.reason_summary,
        created_at=comparison.created_at,
    )


def _case_response(item: BaselineComparisonCase) -> BaselineComparisonCaseResponse:
    return BaselineComparisonCaseResponse(
        id=item.id,
        comparison_id=item.comparison_id,
        dataset_version_case_id=item.dataset_version_case_id,
        case_key=item.case_key,
        baseline_status=item.baseline_status,
        current_status=item.current_status,
        change_status=item.change_status,
        reason_code=item.reason_code,
        created_at=item.created_at,
    )


@router.post("", status_code=201)
async def create_comparison(
    request: Request,
    payload: BaselineComparisonCreateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    comparison = await BaselineComparisonService(db).create_comparison(payload)
    return {"data": _comparison_response(comparison).model_dump(), "meta": {"request_id": _request_id(request)}}


@router.get("/{comparison_id}")
async def get_comparison(
    request: Request,
    comparison_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    comparison = await BaselineComparisonService(db).get_comparison(comparison_id)
    return {"data": _comparison_response(comparison).model_dump(), "meta": {"request_id": _request_id(request)}}


@router.get("/{comparison_id}/cases")
async def list_comparison_cases(
    request: Request,
    comparison_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BaseListResponse:
    cases, total = await BaselineComparisonService(db).list_cases(comparison_id, page, size)
    return BaseListResponse(
        data=[_case_response(item).model_dump() for item in cases],
        meta=ListMeta(
            request_id=_request_id(request),
            pagination=PaginationMeta(total=total, page=page, size=size),
        ),
    )
