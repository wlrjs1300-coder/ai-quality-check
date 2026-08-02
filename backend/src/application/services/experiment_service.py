from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.application.schemas.experiment import ExperimentCreateRequest
from src.application.services.evaluator_service import EvaluatorService
from src.application.services.target_service import TargetService
from src.domain.models import (
    Dataset,
    DatasetVersion,
    DatasetVersionCase,
    Evaluator,
    EvaluatorVersion,
    EvaluationResult,
    Experiment,
    Project,
    Target,
    TargetVersion,
)


class ExperimentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_experiment(self, payload: ExperimentCreateRequest) -> Experiment:
        dataset_version = await self.db.get(DatasetVersion, payload.dataset_version_id)
        if not dataset_version:
            raise ErrorCodeError("DATASET_VERSION_NOT_FOUND", "Dataset version not found.", 404)

        target_version = await self.db.get(TargetVersion, payload.target_version_id)
        if not target_version:
            raise ErrorCodeError("TARGET_VERSION_NOT_FOUND", "Target version not found.", 404)

        evaluator_version = await self.db.get(EvaluatorVersion, payload.evaluator_version_id)
        if not evaluator_version:
            raise ErrorCodeError("EVALUATOR_VERSION_NOT_FOUND", "Evaluator version not found.", 404)

        dataset = await self.db.get(Dataset, dataset_version.dataset_id)
        project = await self.db.get(Project, dataset.project_id) if dataset else None
        if project is None or not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot run experiment.", 409)
        if dataset is not None and not dataset.is_active:
            raise ErrorCodeError("DATASET_INACTIVE", "Inactive dataset cannot be used for experiment.", 409)

        target = await self.db.get(Target, target_version.target_id)
        if target is None or not target.is_active:
            raise ErrorCodeError("TARGET_INACTIVE", "Inactive target cannot be used for experiment.", 409)
        evaluator = await self.db.get(Evaluator, evaluator_version.evaluator_id)
        if evaluator is None or not evaluator.is_active:
            raise ErrorCodeError("EVALUATOR_INACTIVE", "Inactive evaluator cannot be used for experiment.", 409)

        if project.id != evaluator.project_id or project.id != target.project_id:
            raise ErrorCodeError(
                "INVALID_RESOURCE_SCOPE",
                "Experiment resources must belong to the same project.",
                409,
            )

        cases = await self.db.execute(
            select(DatasetVersionCase)
            .where(DatasetVersionCase.dataset_version_id == dataset_version.id)
            .order_by(DatasetVersionCase.case_key.asc())
        )
        case_rows = list(cases.scalars().all())
        if not case_rows:
            raise ErrorCodeError("EMPTY_DATASET_VERSION", "Dataset version has no cases.", 409)

        experiment = Experiment(
            dataset_version_id=dataset_version.id,
            target_version_id=target_version.id,
            evaluator_version_id=evaluator_version.id,
            total_cases=len(case_rows),
            status="CREATED",
        )
        self.db.add(experiment)
        try:
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ErrorCodeError("EXPERIMENT_CREATION_FAILED", "Experiment creation failed.", 409) from exc

        await self.db.refresh(experiment)
        await self.db.commit()
        return experiment

    async def get_experiment(self, experiment_id: UUID) -> Experiment:
        experiment = await self.db.get(Experiment, experiment_id)
        if not experiment:
            raise ErrorCodeError("EXPERIMENT_NOT_FOUND", "Experiment not found.", 404)
        return experiment

    async def _require_experiment_owner_check(
        self,
        experiment: Experiment,
    ) -> tuple[DatasetVersion, TargetVersion, EvaluatorVersion]:
        dataset_version = await self.db.get(DatasetVersion, experiment.dataset_version_id)
        target_version = await self.db.get(TargetVersion, experiment.target_version_id)
        evaluator_version = await self.db.get(EvaluatorVersion, experiment.evaluator_version_id)
        if not dataset_version:
            raise ErrorCodeError("DATASET_VERSION_NOT_FOUND", "Dataset version not found.", 404)
        if not target_version:
            raise ErrorCodeError("TARGET_VERSION_NOT_FOUND", "Target version not found.", 404)
        if not evaluator_version:
            raise ErrorCodeError("EVALUATOR_VERSION_NOT_FOUND", "Evaluator version not found.", 404)
        return dataset_version, target_version, evaluator_version

    async def run_experiment(self, experiment_id: UUID) -> Experiment:
        async with self.db.begin():
            experiment_stmt = (
                select(Experiment)
                .where(Experiment.id == experiment_id)
                .with_for_update()
            )
            experiment = (await self.db.execute(experiment_stmt)).scalar_one_or_none()
            if not experiment:
                raise ErrorCodeError("EXPERIMENT_NOT_FOUND", "Experiment not found.", 404)
            if experiment.status != "CREATED":
                raise ErrorCodeError("INVALID_STATE_TRANSITION", "Experiment can be run only once.", 409)

            (
                dataset_version,
                target_version,
                evaluator_version,
            ) = await self._require_experiment_owner_check(experiment)
            dataset = await self.db.get(Dataset, dataset_version.dataset_id)
            project = await self.db.get(Project, dataset.project_id) if dataset else None
            if project is None or not project.is_active:
                raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot run experiment.", 409)
            if dataset is None or not dataset.is_active:
                raise ErrorCodeError("DATASET_INACTIVE", "Inactive dataset cannot be used for experiment.", 409)
            target = await self.db.get(Target, target_version.target_id)
            if not target or not target.is_active:
                raise ErrorCodeError("TARGET_INACTIVE", "Inactive target cannot be used for experiment.", 409)
            evaluator = await self.db.get(Evaluator, evaluator_version.evaluator_id)
            if not evaluator or not evaluator.is_active:
                raise ErrorCodeError("EVALUATOR_INACTIVE", "Inactive evaluator cannot be used for experiment.", 409)
            if project.id != target.project_id or project.id != evaluator.project_id:
                raise ErrorCodeError(
                    "INVALID_RESOURCE_SCOPE",
                    "Experiment resources must belong to the same project.",
                    409,
                )

            experiment.status = "RUNNING"
            experiment.error_code = None
            experiment.error_message = None
            experiment.pass_count = 0
            experiment.fail_count = 0
            experiment.error_count = 0

            case_result_rows = await self.db.execute(
                select(DatasetVersionCase)
                .where(DatasetVersionCase.dataset_version_id == dataset_version.id)
                .order_by(DatasetVersionCase.case_key.asc())
            )
            cases = list(case_result_rows.scalars().all())

            target_service = TargetService(self.db)
            evaluator_service = EvaluatorService(self.db)
            experiment_error: tuple[str, str] | None = None

            for case in cases:
                input_snapshot = {"question": case.question}
                status = "PASS"
                reason_code = None
                reason = None
                output_snapshot = {}

                try:
                    _, output_snapshot = await target_service.execute_version(
                        target_version.id,
                        {"input_snapshot": input_snapshot},
                    )
                    if not isinstance(output_snapshot, dict):
                        raise TypeError("Target output must be an object.")

                    eval_result = await evaluator_service.execute_version(
                        evaluator_version.id,
                        {"text": output_snapshot.get("text")},
                    )
                    status = eval_result["status"]
                    reason_code = eval_result["reason_code"]
                    reason = eval_result["reason"]
                except ErrorCodeError as exc:
                    status = "ERROR"
                    reason_code = exc.code
                    reason = str(exc)
                    if experiment_error is None:
                        experiment_error = (exc.code, str(exc))
                except Exception as exc:
                    status = "ERROR"
                    reason_code = "EXECUTION_ERROR"
                    reason = str(exc)
                    if experiment_error is None:
                        experiment_error = ("EXECUTION_ERROR", str(exc))

                if status == "PASS":
                    experiment.pass_count += 1
                elif status == "FAIL":
                    experiment.fail_count += 1
                else:
                    experiment.error_count += 1

                result = EvaluationResult(
                    experiment_id=experiment.id,
                    dataset_version_case_id=case.id,
                    input_snapshot=input_snapshot,
                    output_snapshot=output_snapshot,
                    status=status,
                    reason_code=reason_code,
                    reason=reason,
                )
                self.db.add(result)

            if experiment_error is not None:
                experiment.status = "FAILED"
            else:
                experiment.status = "COMPLETED"

            if experiment_error is None:
                experiment.error_code = None
                experiment.error_message = None
            else:
                experiment.error_code, experiment.error_message = experiment_error
            experiment.completed_at = datetime.now(timezone.utc)

            await self.db.flush()
            await self.db.refresh(experiment)
            return experiment

    async def list_results(self, experiment_id: UUID) -> list[EvaluationResult]:
        experiment = await self.db.get(Experiment, experiment_id)
        if not experiment:
            raise ErrorCodeError("EXPERIMENT_NOT_FOUND", "Experiment not found.", 404)
        result = await self.db.execute(
            select(EvaluationResult)
            .where(EvaluationResult.experiment_id == experiment_id)
            .order_by(EvaluationResult.created_at.asc())
        )
        return list(result.scalars().all())
