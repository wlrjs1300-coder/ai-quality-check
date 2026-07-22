from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import (
    BaseListResponse,
    ExperimentCreateRequest,
    ExperimentResponse,
    ExperimentRunResponse,
    ListMeta,
    PaginationMeta,
    ExperimentResultResponse,
)
from src.application.services import ExperimentService
from src.domain.models import Experiment, EvaluationResult

router = APIRouter(prefix="/experiments", tags=["experiments"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


def _experiment_to_dict(experiment: Experiment) -> dict:
    return {
        "id": str(experiment.id),
        "dataset_version_id": str(experiment.dataset_version_id),
        "target_version_id": str(experiment.target_version_id),
        "evaluator_version_id": str(experiment.evaluator_version_id),
        "status": experiment.status,
        "total_cases": experiment.total_cases,
        "pass_count": experiment.pass_count,
        "fail_count": experiment.fail_count,
        "error_count": experiment.error_count,
        "completed_at": experiment.completed_at,
        "error_code": experiment.error_code,
        "error_message": experiment.error_message,
    }


def _result_to_dict(result: EvaluationResult) -> dict:
    return {
        "id": str(result.id),
        "experiment_id": str(result.experiment_id),
        "dataset_version_case_id": str(result.dataset_version_case_id),
        "input_snapshot": result.input_snapshot,
        "output_snapshot": result.output_snapshot,
        "status": result.status,
        "reason_code": result.reason_code,
        "reason": result.reason,
        "created_at": result.created_at,
    }


@router.post("", status_code=201)
async def create_experiment(
    request: Request,
    payload: ExperimentCreateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = ExperimentService(db)
    experiment = await service.create_experiment(payload)
    response = ExperimentResponse(**_experiment_to_dict(experiment))
    return {"data": response.model_dump(), "meta": {"request_id": _request_id(request)}}


@router.post("/{experiment_id}/run")
async def run_experiment(
    request: Request,
    experiment_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = ExperimentService(db)
    experiment = await service.run_experiment(experiment_id)
    response = ExperimentRunResponse(**_experiment_to_dict(experiment))
    return {"data": response.model_dump(), "meta": {"request_id": _request_id(request)}}


@router.get("/{experiment_id}")
async def get_experiment(
    request: Request,
    experiment_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    service = ExperimentService(db)
    experiment = await service.get_experiment(experiment_id)
    response = ExperimentResponse(**_experiment_to_dict(experiment))
    return {"data": response.model_dump(), "meta": {"request_id": _request_id(request)}}


@router.get("/{experiment_id}/results")
async def list_experiment_results(
    request: Request,
    experiment_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BaseListResponse:
    service = ExperimentService(db)
    results = await service.list_results(experiment_id)
    total = len(results)
    offset = (page - 1) * size
    return BaseListResponse(
        data=[ExperimentResultResponse(**_result_to_dict(item)).model_dump() for item in results[offset : offset + size]],
        meta=ListMeta(
            request_id=_request_id(request),
            pagination=PaginationMeta(total=total, page=page, size=size),
        ),
    )
