from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.application.schemas.quality_gate import QualityGatePolicyCreateRequest
from src.domain.models import (
    Dataset,
    DatasetVersion,
    DatasetVersionCase,
    EvaluationResult,
    Experiment,
    Project,
    QualityGatePolicy,
    QualityGateResult,
)


class QualityGateService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_policy(self, project_id: UUID, payload: QualityGatePolicyCreateRequest) -> QualityGatePolicy:
        project = await self.db.get(Project, project_id)
        if project is None:
            raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)
        if not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot create a quality gate policy.", 409)

        policy = QualityGatePolicy(
            project_id=project_id,
            name=payload.name,
            minimum_pass_rate=payload.minimum_pass_rate,
            block_on_error=payload.block_on_error,
            block_on_required_case_failure=payload.block_on_required_case_failure,
        )
        self.db.add(policy)
        try:
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ErrorCodeError(
                "DUPLICATE_QUALITY_GATE_POLICY_NAME_IN_PROJECT",
                "Quality gate policy name already exists in project.",
                409,
            ) from exc
        await self.db.refresh(policy)
        await self.db.commit()
        return policy

    async def get_policy(self, policy_id: UUID) -> QualityGatePolicy:
        policy = await self.db.get(QualityGatePolicy, policy_id)
        if policy is None:
            raise ErrorCodeError("QUALITY_GATE_POLICY_NOT_FOUND", "Quality gate policy not found.", 404)
        return policy

    async def get_result(self, result_id: UUID) -> QualityGateResult:
        result = await self.db.get(QualityGateResult, result_id)
        if result is None:
            raise ErrorCodeError("QUALITY_GATE_RESULT_NOT_FOUND", "Quality gate result not found.", 404)
        return result

    async def evaluate(self, policy_id: UUID, experiment_id: UUID) -> QualityGateResult:
        async with self.db.begin():
            policy_row = await self.db.execute(
                select(QualityGatePolicy).where(QualityGatePolicy.id == policy_id).with_for_update()
            )
            policy = policy_row.scalar_one_or_none()
            if policy is None:
                raise ErrorCodeError("QUALITY_GATE_POLICY_NOT_FOUND", "Quality gate policy not found.", 404)
            if not policy.is_active:
                raise ErrorCodeError("QUALITY_GATE_POLICY_INACTIVE", "Inactive quality gate policy cannot run.", 409)

            experiment = await self.db.get(Experiment, experiment_id)
            if experiment is None:
                raise ErrorCodeError("EXPERIMENT_NOT_FOUND", "Experiment not found.", 404)
            if experiment.status != "COMPLETED":
                raise ErrorCodeError("EXPERIMENT_NOT_COMPLETED", "Only completed experiments can be evaluated.", 409)

            dataset_version = await self.db.get(DatasetVersion, experiment.dataset_version_id)
            dataset = await self.db.get(Dataset, dataset_version.dataset_id) if dataset_version else None
            if dataset is None or dataset.project_id != policy.project_id:
                raise ErrorCodeError(
                    "QUALITY_GATE_PROJECT_MISMATCH",
                    "Quality gate policy and experiment must belong to the same project.",
                    409,
                )

            duplicate = await self.db.execute(
                select(QualityGateResult).where(
                    QualityGateResult.policy_id == policy_id,
                    QualityGateResult.experiment_id == experiment_id,
                )
            )
            if duplicate.scalar_one_or_none() is not None:
                raise ErrorCodeError("QUALITY_GATE_ALREADY_EVALUATED", "Quality gate was already evaluated.", 409)

            counts = await self.db.execute(
                select(EvaluationResult.status, func.count(EvaluationResult.id))
                .where(EvaluationResult.experiment_id == experiment_id)
                .group_by(EvaluationResult.status)
            )
            status_counts = {status: count for status, count in counts.all()}
            total_count = sum(status_counts.values())
            if total_count == 0:
                raise ErrorCodeError("EMPTY_EXPERIMENT_RESULTS", "Experiment has no evaluation results.", 409)

            required_failures = await self.db.scalar(
                select(func.count(EvaluationResult.id))
                .join(DatasetVersionCase, DatasetVersionCase.id == EvaluationResult.dataset_version_case_id)
                .where(
                    EvaluationResult.experiment_id == experiment_id,
                    DatasetVersionCase.required_for_release.is_(True),
                    EvaluationResult.status != "PASS",
                )
            )
            passed_count = int(status_counts.get("PASS", 0))
            failed_count = int(status_counts.get("FAIL", 0))
            error_count = int(status_counts.get("ERROR", 0))
            required_failure_count = int(required_failures or 0)
            pass_rate = (Decimal(passed_count) / Decimal(total_count)).quantize(Decimal("0.0001"))

            reason_codes: list[str] = []
            if pass_rate < policy.minimum_pass_rate:
                reason_codes.append("PASS_RATE_BELOW_THRESHOLD")
            if policy.block_on_error and error_count > 0:
                reason_codes.append("ERROR_RESULTS_PRESENT")
            if policy.block_on_required_case_failure and required_failure_count > 0:
                reason_codes.append("REQUIRED_CASE_FAILURE_PRESENT")

            result = QualityGateResult(
                policy_id=policy_id,
                experiment_id=experiment_id,
                status="BLOCK" if reason_codes else "PASS",
                pass_rate=pass_rate,
                total_case_count=total_count,
                passed_case_count=passed_count,
                failed_case_count=failed_count,
                error_case_count=error_count,
                required_case_failure_count=required_failure_count,
                reason_codes=reason_codes,
                reason_summary="; ".join(reason_codes) if reason_codes else None,
            )
            self.db.add(result)
            try:
                await self.db.flush()
            except IntegrityError as exc:
                await self.db.rollback()
                raise ErrorCodeError(
                    "QUALITY_GATE_ALREADY_EVALUATED",
                    "Quality gate was already evaluated.",
                    409,
                ) from exc
            await self.db.refresh(result)
            return result
