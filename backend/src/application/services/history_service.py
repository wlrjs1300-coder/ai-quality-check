from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from src.application.errors import ErrorCodeError
from src.domain.models import (
    BaselineComparison,
    Dataset,
    DatasetVersion,
    Experiment,
    Project,
    QualityGateResult,
)

ExperimentSort = Literal["created_at_desc", "created_at_asc"]


class HistoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _require_project(self, project_id: UUID) -> None:
        if await self.db.get(Project, project_id) is None:
            raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)

    @staticmethod
    def _validate_date_range(created_from: datetime | None, created_to: datetime | None) -> None:
        if created_from is not None and created_to is not None and created_from > created_to:
            raise ErrorCodeError(
                "INVALID_HISTORY_DATE_RANGE",
                "created_from must be earlier than or equal to created_to.",
                422,
            )

    @staticmethod
    def _latest_gate_subquery():
        ranked = select(
            QualityGateResult.id.label("result_id"),
            QualityGateResult.experiment_id.label("experiment_id"),
            func.row_number()
            .over(
                partition_by=QualityGateResult.experiment_id,
                order_by=(QualityGateResult.created_at.desc(), QualityGateResult.id.desc()),
            )
            .label("row_number"),
        ).subquery()
        return select(ranked.c.result_id, ranked.c.experiment_id).where(ranked.c.row_number == 1).subquery()

    @staticmethod
    def _latest_comparison_subquery():
        ranked = select(
            BaselineComparison.id.label("comparison_id"),
            BaselineComparison.current_experiment_id.label("current_experiment_id"),
            func.row_number()
            .over(
                partition_by=BaselineComparison.current_experiment_id,
                order_by=(BaselineComparison.created_at.desc(), BaselineComparison.id.desc()),
            )
            .label("row_number"),
        ).subquery()
        return select(ranked.c.comparison_id, ranked.c.current_experiment_id).where(
            ranked.c.row_number == 1
        ).subquery()

    def _base_statement(
        self,
        project_id: UUID,
        created_from: datetime | None,
        created_to: datetime | None,
    ) -> tuple[Select, type[QualityGateResult], type[BaselineComparison]]:
        latest_gate = self._latest_gate_subquery()
        latest_comparison = self._latest_comparison_subquery()
        gate = aliased(QualityGateResult)
        comparison = aliased(BaselineComparison)
        statement = (
            select(Experiment, gate, comparison)
            .join(DatasetVersion, DatasetVersion.id == Experiment.dataset_version_id)
            .join(Dataset, Dataset.id == DatasetVersion.dataset_id)
            .outerjoin(latest_gate, latest_gate.c.experiment_id == Experiment.id)
            .outerjoin(gate, gate.id == latest_gate.c.result_id)
            .outerjoin(latest_comparison, latest_comparison.c.current_experiment_id == Experiment.id)
            .outerjoin(comparison, comparison.id == latest_comparison.c.comparison_id)
            .where(Dataset.project_id == project_id)
        )
        if created_from is not None:
            statement = statement.where(Experiment.created_at >= created_from)
        if created_to is not None:
            statement = statement.where(Experiment.created_at <= created_to)
        return statement, gate, comparison

    @staticmethod
    def _pass_rate(experiment: Experiment) -> Decimal | None:
        if experiment.total_cases <= 0:
            return None
        return Decimal(experiment.pass_count) / Decimal(experiment.total_cases)

    @classmethod
    def _history_item(
        cls,
        experiment: Experiment,
        gate: QualityGateResult | None,
        comparison: BaselineComparison | None,
    ) -> dict:
        gate_item = None
        if gate is not None:
            gate_item = {
                "result_id": gate.id,
                "policy_id": gate.policy_id,
                "status": gate.status,
                "pass_rate": gate.pass_rate,
                "reason_codes": gate.reason_codes,
                "created_at": gate.created_at,
            }
        comparison_item = None
        if comparison is not None:
            comparison_item = {
                "comparison_id": comparison.id,
                "baseline_experiment_id": comparison.baseline_experiment_id,
                "current_experiment_id": comparison.current_experiment_id,
                "status": comparison.status,
                "pass_rate_delta": comparison.pass_rate_delta,
                "reason_codes": comparison.reason_codes,
                "created_at": comparison.created_at,
            }
        return {
            "experiment_id": experiment.id,
            "dataset_version_id": experiment.dataset_version_id,
            "target_version_id": experiment.target_version_id,
            "evaluator_version_id": experiment.evaluator_version_id,
            "experiment_status": experiment.status,
            "total_case_count": experiment.total_cases,
            "passed_case_count": experiment.pass_count,
            "failed_case_count": experiment.fail_count,
            "error_case_count": experiment.error_count,
            "pass_rate": cls._pass_rate(experiment),
            "created_at": experiment.created_at,
            "started_at": None,
            "completed_at": experiment.completed_at,
            "quality_gate_result": gate_item,
            "baseline_comparison": comparison_item,
        }

    async def list_history(
        self,
        project_id: UUID,
        page: int,
        size: int,
        experiment_status: str | None = None,
        gate_status: str | None = None,
        comparison_status: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        sort: ExperimentSort = "created_at_desc",
    ) -> tuple[list[dict], int]:
        await self._require_project(project_id)
        self._validate_date_range(created_from, created_to)
        statement, gate, comparison = self._base_statement(project_id, created_from, created_to)
        if experiment_status is not None:
            statement = statement.where(Experiment.status == experiment_status)
        if gate_status is not None:
            statement = statement.where(gate.status == gate_status)
        if comparison_status is not None:
            statement = statement.where(comparison.status == comparison_status)

        count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
        total = int((await self.db.execute(count_statement)).scalar_one())
        if sort == "created_at_asc":
            statement = statement.order_by(Experiment.created_at.asc(), Experiment.id.asc())
        else:
            statement = statement.order_by(Experiment.created_at.desc(), Experiment.id.desc())
        rows = (await self.db.execute(statement.offset((page - 1) * size).limit(size))).all()
        return [self._history_item(experiment, gate, comparison) for experiment, gate, comparison in rows], total

    async def list_history_for_export(
        self,
        project_id: UUID,
        row_limit: int,
        experiment_status: str | None = None,
        gate_status: str | None = None,
        comparison_status: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        sort: ExperimentSort = "created_at_desc",
    ) -> list[dict]:
        items, total = await self.list_history(
            project_id=project_id,
            page=1,
            size=row_limit + 1,
            experiment_status=experiment_status,
            gate_status=gate_status,
            comparison_status=comparison_status,
            created_from=created_from,
            created_to=created_to,
            sort=sort,
        )
        if total > row_limit:
            raise ErrorCodeError(
                "CSV_EXPORT_ROW_LIMIT_EXCEEDED",
                "CSV export row limit exceeded.",
                409,
                details={"total": total, "limit": row_limit},
            )
        return items

    async def trend_summary(
        self,
        project_id: UUID,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> dict:
        await self._require_project(project_id)
        self._validate_date_range(created_from, created_to)
        statement, _, _ = self._base_statement(project_id, created_from, created_to)
        statement = statement.order_by(
            Experiment.created_at.asc(), Experiment.id.asc()
        )
        rows = (await self.db.execute(statement)).all()
        items = [self._history_item(experiment, gate, comparison) for experiment, gate, comparison in rows]
        completed_rates = [item["pass_rate"] for item in items if item["experiment_status"] == "COMPLETED" and item["pass_rate"] is not None]
        first_rate = completed_rates[0] if completed_rates else None
        latest_rate = completed_rates[-1] if completed_rates else None
        average_rate = sum(completed_rates, Decimal("0")) / len(completed_rates) if completed_rates else None
        latest_item = items[-1] if items else None
        return {
            "project_id": project_id,
            "created_from": created_from,
            "created_to": created_to,
            "experiment_count": len(items),
            "pending_experiment_count": sum(item["experiment_status"] == "CREATED" for item in items),
            "running_experiment_count": sum(item["experiment_status"] == "RUNNING" for item in items),
            "completed_experiment_count": sum(item["experiment_status"] == "COMPLETED" for item in items),
            "failed_experiment_count": sum(item["experiment_status"] == "FAILED" for item in items),
            "average_pass_rate": average_rate,
            "first_pass_rate": first_rate,
            "latest_pass_rate": latest_rate,
            "pass_rate_delta": latest_rate - first_rate if latest_rate is not None and first_rate is not None else None,
            "gate_pass_count": sum((item["quality_gate_result"] or {}).get("status") == "PASS" for item in items),
            "gate_block_count": sum((item["quality_gate_result"] or {}).get("status") == "BLOCK" for item in items),
            "gate_missing_count": sum(item["quality_gate_result"] is None for item in items),
            "comparison_improved_count": sum((item["baseline_comparison"] or {}).get("status") == "IMPROVED" for item in items),
            "comparison_unchanged_count": sum((item["baseline_comparison"] or {}).get("status") == "UNCHANGED" for item in items),
            "comparison_regressed_count": sum((item["baseline_comparison"] or {}).get("status") == "REGRESSED" for item in items),
            "comparison_missing_count": sum(item["baseline_comparison"] is None for item in items),
            "latest_experiment": latest_item,
            "latest_quality_gate_result": next((item["quality_gate_result"] for item in reversed(items) if item["quality_gate_result"] is not None), None),
            "latest_baseline_comparison": next((item["baseline_comparison"] for item in reversed(items) if item["baseline_comparison"] is not None), None),
        }
