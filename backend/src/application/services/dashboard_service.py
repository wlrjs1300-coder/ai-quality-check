from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.application.services.history_service import HistoryService
from src.application.services.project_summary_service import ProjectSummaryReportService

TREND_SUMMARIES = {
    "IMPROVING": "Project pass rate is improving over the selected period.",
    "STABLE": "Project pass rate is stable over the selected period.",
    "DECLINING": "Project pass rate is declining over the selected period.",
    "UNKNOWN": "Pass rate trend is unavailable for the selected period.",
}


class ProjectDashboardOverviewService:
    def __init__(self, db: AsyncSession):
        self.summary_service = ProjectSummaryReportService(db)
        self.history_service = HistoryService(db)

    @staticmethod
    def _trend_direction(delta: Decimal | None) -> str:
        if delta is None:
            return "UNKNOWN"
        if delta > 0:
            return "IMPROVING"
        if delta < 0:
            return "DECLINING"
        return "STABLE"

    async def get_overview(
        self,
        project_id: UUID,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> dict:
        report = await self.summary_service.get_summary_report(
            project_id,
            created_from,
            created_to,
        )
        recent, _ = await self.history_service.list_history(
            project_id=project_id,
            page=1,
            size=5,
            created_from=created_from,
            created_to=created_to,
            sort="created_at_desc",
        )
        metrics = report["metrics"]
        direction = self._trend_direction(metrics["pass_rate_delta"])
        return {
            "project": report["project"],
            "period": report["period"],
            "readiness": report["readiness"],
            "kpis": {
                "experiment_count": metrics["experiment_count"],
                "completed_experiment_count": metrics["completed_experiment_count"],
                "failed_experiment_count": metrics["failed_experiment_count"],
                "running_experiment_count": metrics["running_experiment_count"],
                "latest_pass_rate": metrics["latest_pass_rate"],
                "average_pass_rate": metrics["average_pass_rate"],
                "pass_rate_delta": metrics["pass_rate_delta"],
                "gate_pass_count": metrics["gate_pass_count"],
                "gate_block_count": metrics["gate_block_count"],
                "comparison_regressed_count": metrics["comparison_regressed_count"],
            },
            "recent_experiments": [
                {
                    "experiment_id": item["experiment_id"],
                    "experiment_status": item["experiment_status"],
                    "pass_rate": item["pass_rate"],
                    "total_case_count": item["total_case_count"],
                    "passed_case_count": item["passed_case_count"],
                    "failed_case_count": item["failed_case_count"],
                    "error_case_count": item["error_case_count"],
                    "created_at": item["created_at"],
                    "completed_at": item["completed_at"],
                    "quality_gate_status": (
                        item["quality_gate_result"]["status"]
                        if item["quality_gate_result"] is not None
                        else None
                    ),
                    "baseline_comparison_status": (
                        item["baseline_comparison"]["status"]
                        if item["baseline_comparison"] is not None
                        else None
                    ),
                }
                for item in recent
            ],
            "latest_quality_gate_result": report["latest_quality_gate_result"],
            "latest_baseline_comparison": report["latest_baseline_comparison"],
            "trend": {
                "direction": direction,
                "first_pass_rate": metrics["first_pass_rate"],
                "latest_pass_rate": metrics["latest_pass_rate"],
                "pass_rate_delta": metrics["pass_rate_delta"],
                "summary": TREND_SUMMARIES[direction],
            },
            "warning_codes": report["warning_codes"],
        }
