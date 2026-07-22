from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.application.schemas.baseline_comparison import BaselineComparisonCreateRequest
from src.domain.models import (
    BaselineComparison,
    BaselineComparisonCase,
    Dataset,
    DatasetVersion,
    DatasetVersionCase,
    EvaluationResult,
    Experiment,
)


_STATUS_RANK = {"ERROR": 0, "FAIL": 1, "PASS": 2}
_REASON_CODES = {
    ("PASS", "PASS"): "STATUS_UNCHANGED",
    ("FAIL", "FAIL"): "STATUS_UNCHANGED",
    ("ERROR", "ERROR"): "STATUS_UNCHANGED",
    ("FAIL", "PASS"): "FAIL_TO_PASS",
    ("ERROR", "PASS"): "ERROR_TO_PASS",
    ("ERROR", "FAIL"): "ERROR_TO_FAIL",
    ("PASS", "FAIL"): "PASS_TO_FAIL",
    ("PASS", "ERROR"): "PASS_TO_ERROR",
    ("FAIL", "ERROR"): "FAIL_TO_ERROR",
}


class BaselineComparisonService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_comparison(self, payload: BaselineComparisonCreateRequest) -> BaselineComparison:
        if payload.baseline_experiment_id == payload.current_experiment_id:
            raise ErrorCodeError(
                "BASELINE_COMPARISON_SAME_EXPERIMENT",
                "Baseline and current experiments must be different.",
                409,
            )

        try:
            async with self.db.begin():
                experiment_ids = sorted(
                    (payload.baseline_experiment_id, payload.current_experiment_id),
                    key=str,
                )
                locked = await self.db.execute(
                    select(Experiment)
                    .where(Experiment.id.in_(experiment_ids))
                    .order_by(Experiment.id.asc())
                    .with_for_update()
                )
                experiments = {item.id: item for item in locked.scalars().all()}
                baseline = experiments.get(payload.baseline_experiment_id)
                current = experiments.get(payload.current_experiment_id)
                if baseline is None:
                    raise ErrorCodeError("BASELINE_EXPERIMENT_NOT_FOUND", "Baseline experiment not found.", 404)
                if current is None:
                    raise ErrorCodeError("CURRENT_EXPERIMENT_NOT_FOUND", "Current experiment not found.", 404)
                if baseline.status != "COMPLETED":
                    raise ErrorCodeError(
                        "BASELINE_EXPERIMENT_NOT_COMPLETED",
                        "Baseline experiment must be completed.",
                        409,
                    )
                if current.status != "COMPLETED":
                    raise ErrorCodeError(
                        "CURRENT_EXPERIMENT_NOT_COMPLETED",
                        "Current experiment must be completed.",
                        409,
                    )
                baseline_version = await self.db.get(DatasetVersion, baseline.dataset_version_id)
                current_version = await self.db.get(DatasetVersion, current.dataset_version_id)
                baseline_dataset = (
                    await self.db.get(Dataset, baseline_version.dataset_id) if baseline_version else None
                )
                current_dataset = (
                    await self.db.get(Dataset, current_version.dataset_id) if current_version else None
                )
                if baseline_dataset is None or current_dataset is None:
                    raise ErrorCodeError(
                        "BASELINE_COMPARISON_PROJECT_MISMATCH",
                        "Experiment project could not be resolved.",
                        409,
                    )
                if baseline_dataset.project_id != current_dataset.project_id:
                    raise ErrorCodeError(
                        "BASELINE_COMPARISON_PROJECT_MISMATCH",
                        "Experiments must belong to the same project.",
                        409,
                    )
                if baseline.dataset_version_id != current.dataset_version_id:
                    raise ErrorCodeError(
                        "BASELINE_DATASET_VERSION_MISMATCH",
                        "Experiments must use the same dataset version.",
                        409,
                    )

                baseline_rows = await self._result_map(baseline.id)
                current_rows = await self._result_map(current.id)
                if not baseline_rows or not current_rows:
                    raise ErrorCodeError("EMPTY_EXPERIMENT_RESULTS", "Experiments must contain results.", 409)
                if set(baseline_rows) != set(current_rows) or len(baseline_rows) != len(current_rows):
                    raise ErrorCodeError(
                        "BASELINE_RESULT_SET_MISMATCH",
                        "Experiment result sets must match exactly.",
                        409,
                    )

                duplicate = await self.db.scalar(
                    select(BaselineComparison.id).where(
                        BaselineComparison.baseline_experiment_id == baseline.id,
                        BaselineComparison.current_experiment_id == current.id,
                    )
                )
                if duplicate is not None:
                    raise ErrorCodeError(
                        "BASELINE_COMPARISON_ALREADY_EXISTS",
                        "Comparison already exists for these experiments.",
                        409,
                    )

                case_ids = list(baseline_rows)
                case_query = await self.db.execute(
                    select(DatasetVersionCase).where(DatasetVersionCase.id.in_(case_ids))
                )
                cases = {item.id: item for item in case_query.scalars().all()}
                if len(cases) != len(case_ids) or any(
                    item.dataset_version_id != baseline.dataset_version_id for item in cases.values()
                ):
                    raise ErrorCodeError(
                        "BASELINE_RESULT_SET_MISMATCH",
                        "Experiment results do not match the dataset version.",
                        409,
                    )

                changes: list[tuple[UUID, str, str, str, str]] = []
                counts = {"IMPROVED": 0, "UNCHANGED": 0, "REGRESSED": 0}
                for case_id in sorted(case_ids, key=lambda item: cases[item].case_key):
                    baseline_status = baseline_rows[case_id].status
                    current_status = current_rows[case_id].status
                    delta = _STATUS_RANK[current_status] - _STATUS_RANK[baseline_status]
                    change_status = "IMPROVED" if delta > 0 else "REGRESSED" if delta < 0 else "UNCHANGED"
                    counts[change_status] += 1
                    changes.append(
                        (
                            case_id,
                            baseline_status,
                            current_status,
                            change_status,
                            _REASON_CODES[(baseline_status, current_status)],
                        )
                    )

                total = len(changes)
                baseline_passed = sum(item.status == "PASS" for item in baseline_rows.values())
                current_passed = sum(item.status == "PASS" for item in current_rows.values())
                pass_rate_delta = (
                    Decimal(current_passed - baseline_passed) / Decimal(total)
                ).quantize(Decimal("0.0001"))
                if counts["REGRESSED"] > 0:
                    status = "REGRESSED"
                    reason_codes = ["CASE_REGRESSION_PRESENT"]
                elif counts["IMPROVED"] > 0:
                    status = "IMPROVED"
                    reason_codes = ["CASE_IMPROVEMENT_PRESENT"]
                else:
                    status = "UNCHANGED"
                    reason_codes = ["NO_CASE_CHANGE"]

                comparison = BaselineComparison(
                    project_id=baseline_dataset.project_id,
                    baseline_experiment_id=baseline.id,
                    current_experiment_id=current.id,
                    status=status,
                    total_case_count=total,
                    improved_case_count=counts["IMPROVED"],
                    unchanged_case_count=counts["UNCHANGED"],
                    regressed_case_count=counts["REGRESSED"],
                    baseline_passed_case_count=baseline_passed,
                    current_passed_case_count=current_passed,
                    pass_rate_delta=pass_rate_delta,
                    reason_codes=reason_codes,
                    reason_summary=self._reason_summary(counts),
                )
                self.db.add(comparison)
                await self.db.flush()
                for case_id, baseline_status, current_status, change_status, reason_code in changes:
                    self.db.add(
                        BaselineComparisonCase(
                            comparison_id=comparison.id,
                            dataset_version_case_id=case_id,
                            case_key=cases[case_id].case_key,
                            baseline_status=baseline_status,
                            current_status=current_status,
                            change_status=change_status,
                            reason_code=reason_code,
                        )
                    )
                await self.db.flush()
                await self.db.refresh(comparison)
                return comparison
        except IntegrityError as exc:
            raise ErrorCodeError(
                "BASELINE_COMPARISON_ALREADY_EXISTS",
                "Comparison already exists for these experiments.",
                409,
            ) from exc

    async def _result_map(self, experiment_id: UUID) -> dict[UUID, EvaluationResult]:
        rows = await self.db.execute(
            select(EvaluationResult).where(EvaluationResult.experiment_id == experiment_id)
        )
        results = list(rows.scalars().all())
        mapped = {item.dataset_version_case_id: item for item in results}
        if len(mapped) != len(results):
            raise ErrorCodeError(
                "BASELINE_RESULT_SET_MISMATCH",
                "Experiment result sets contain duplicate cases.",
                409,
            )
        return mapped

    async def get_comparison(self, comparison_id: UUID) -> BaselineComparison:
        comparison = await self.db.get(BaselineComparison, comparison_id)
        if comparison is None:
            raise ErrorCodeError("BASELINE_COMPARISON_NOT_FOUND", "Baseline comparison not found.", 404)
        return comparison

    async def list_cases(
        self,
        comparison_id: UUID,
        page: int,
        size: int,
    ) -> tuple[list[BaselineComparisonCase], int]:
        await self.get_comparison(comparison_id)
        total = int(
            await self.db.scalar(
                select(func.count(BaselineComparisonCase.id)).where(
                    BaselineComparisonCase.comparison_id == comparison_id
                )
            )
            or 0
        )
        rows = await self.db.execute(
            select(BaselineComparisonCase)
            .where(BaselineComparisonCase.comparison_id == comparison_id)
            .order_by(BaselineComparisonCase.case_key.asc())
            .offset((page - 1) * size)
            .limit(size)
        )
        return list(rows.scalars().all()), total

    @staticmethod
    def _reason_summary(counts: dict[str, int]) -> str:
        return (
            f"Improved: {counts['IMPROVED']}; "
            f"unchanged: {counts['UNCHANGED']}; "
            f"regressed: {counts['REGRESSED']}."
        )
