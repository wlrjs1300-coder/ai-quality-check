from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db_session
from src.application.schemas import (
    QualityGateEvaluateRequest,
    QualityGatePolicyCreateRequest,
    QualityGatePolicyResponse,
    QualityGateResultResponse,
)
from src.application.services import QualityGateService
from src.domain.models import QualityGatePolicy, QualityGateResult

router = APIRouter(tags=["quality-gates"])


def _request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local-request")


def _policy_response(policy: QualityGatePolicy) -> QualityGatePolicyResponse:
    return QualityGatePolicyResponse(
        id=policy.id,
        project_id=policy.project_id,
        name=policy.name,
        minimum_pass_rate=policy.minimum_pass_rate,
        block_on_error=policy.block_on_error,
        block_on_required_case_failure=policy.block_on_required_case_failure,
        is_active=policy.is_active,
        created_at=policy.created_at,
        updated_at=policy.updated_at,
    )


def _result_response(result: QualityGateResult) -> QualityGateResultResponse:
    return QualityGateResultResponse(
        id=result.id,
        policy_id=result.policy_id,
        experiment_id=result.experiment_id,
        status=result.status,
        pass_rate=result.pass_rate,
        total_case_count=result.total_case_count,
        passed_case_count=result.passed_case_count,
        failed_case_count=result.failed_case_count,
        error_case_count=result.error_case_count,
        required_case_failure_count=result.required_case_failure_count,
        reason_codes=result.reason_codes,
        reason_summary=result.reason_summary,
        created_at=result.created_at,
    )


@router.post("/projects/{project_id}/quality-gate-policies", status_code=201)
async def create_policy(
    request: Request,
    project_id: UUID,
    payload: QualityGatePolicyCreateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    policy = await QualityGateService(db).create_policy(project_id, payload)
    return {"data": _policy_response(policy).model_dump(), "meta": {"request_id": _request_id(request)}}


@router.get("/quality-gate-policies/{policy_id}")
async def get_policy(
    request: Request,
    policy_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    policy = await QualityGateService(db).get_policy(policy_id)
    return {"data": _policy_response(policy).model_dump(), "meta": {"request_id": _request_id(request)}}


@router.post("/quality-gate-policies/{policy_id}/evaluate")
async def evaluate(
    request: Request,
    policy_id: UUID,
    payload: QualityGateEvaluateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    result = await QualityGateService(db).evaluate(policy_id, payload.experiment_id)
    return {"data": _result_response(result).model_dump(), "meta": {"request_id": _request_id(request)}}


@router.get("/quality-gate-results/{result_id}")
async def get_result(
    request: Request,
    result_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    result = await QualityGateService(db).get_result(result_id)
    return {"data": _result_response(result).model_dump(), "meta": {"request_id": _request_id(request)}}
