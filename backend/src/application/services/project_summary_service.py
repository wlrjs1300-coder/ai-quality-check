from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.application.services.history_service import HistoryService
from src.domain.models import Project

READY_SUMMARY = "The latest completed experiment passed the quality gate and no regression was detected."
UNKNOWN_SUMMARY = (
    "Release readiness cannot be determined because no completed experiment with a quality gate result is available."
)


class ProjectSummaryReportService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.history_service = HistoryService(db)

    @staticmethod
    def _readiness(trend: dict) -> dict:
        latest = trend["latest_experiment"]
        if latest is None:
            return {
                "status": "UNKNOWN",
                "reason_codes": ["NO_EXPERIMENTS"],
                "reason_summary": UNKNOWN_SUMMARY,
            }

        status = latest["experiment_status"]
        if status == "FAILED":
            return {
                "status": "NOT_READY",
                "reason_codes": ["LATEST_EXPERIMENT_FAILED"],
                "reason_summary": "The project is not ready for release because the latest experiment failed.",
            }
        if status in {"CREATED", "RUNNING"}:
            return {
                "status": "UNKNOWN",
                "reason_codes": ["LATEST_EXPERIMENT_NOT_COMPLETED"],
                "reason_summary": UNKNOWN_SUMMARY,
            }

        gate = latest["quality_gate_result"]
        comparison = latest["baseline_comparison"]
        if gate is None:
            return {
                "status": "UNKNOWN",
                "reason_codes": ["QUALITY_GATE_MISSING"],
                "reason_summary": UNKNOWN_SUMMARY,
            }

        reasons = []
        if gate["status"] == "BLOCK":
            reasons.append("QUALITY_GATE_BLOCKED")
        if comparison is not None and comparison["status"] == "REGRESSED":
            reasons.append("BASELINE_REGRESSION_PRESENT")
        if reasons:
            if len(reasons) == 2:
                summary = (
                    "The project is not ready for release because the latest quality gate is blocked "
                    "and a regression was detected."
                )
            elif reasons[0] == "QUALITY_GATE_BLOCKED":
                summary = "The project is not ready for release because the latest quality gate is blocked."
            else:
                summary = "The project is not ready for release because a regression was detected."
            return {"status": "NOT_READY", "reason_codes": reasons, "reason_summary": summary}

        return {
            "status": "READY",
            "reason_codes": ["READY_FOR_RELEASE"],
            "reason_summary": READY_SUMMARY,
        }

    @staticmethod
    def _warnings(project: Project, trend: dict) -> list[str]:
        warnings = []
        checks = (
            (not project.is_active, "PROJECT_INACTIVE"),
            (trend["failed_experiment_count"] > 0, "FAILED_EXPERIMENTS_PRESENT"),
            (trend["running_experiment_count"] > 0, "RUNNING_EXPERIMENTS_PRESENT"),
            (trend["gate_block_count"] > 0, "GATE_BLOCK_HISTORY_PRESENT"),
            (trend["comparison_regressed_count"] > 0, "REGRESSION_HISTORY_PRESENT"),
            (trend["pass_rate_delta"] is not None and trend["pass_rate_delta"] < 0, "PASS_RATE_DECLINING"),
            (trend["latest_pass_rate"] is None, "PASS_RATE_UNAVAILABLE"),
            (trend["gate_pass_count"] == 0 and trend["gate_block_count"] == 0, "NO_QUALITY_GATE_HISTORY"),
            (
                trend["comparison_improved_count"] == 0
                and trend["comparison_unchanged_count"] == 0
                and trend["comparison_regressed_count"] == 0,
                "NO_BASELINE_HISTORY",
            ),
        )
        for applies, code in checks:
            if applies:
                warnings.append(code)
        return warnings

    async def get_summary_report(
        self,
        project_id: UUID,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> dict:
        project = await self.db.get(Project, project_id)
        if project is None:
            raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)

        trend = await self.history_service.trend_summary(project_id, created_from, created_to)
        readiness = self._readiness(trend)
        metric_names = (
            "experiment_count",
            "pending_experiment_count",
            "running_experiment_count",
            "completed_experiment_count",
            "failed_experiment_count",
            "average_pass_rate",
            "first_pass_rate",
            "latest_pass_rate",
            "pass_rate_delta",
            "gate_pass_count",
            "gate_block_count",
            "gate_missing_count",
            "comparison_improved_count",
            "comparison_unchanged_count",
            "comparison_regressed_count",
            "comparison_missing_count",
        )
        return {
            "project": {
                "project_id": project.id,
                "slug": project.slug,
                "name": project.name,
                "description": project.description,
                "is_active": project.is_active,
                "created_at": project.created_at,
                "updated_at": project.updated_at,
            },
            "period": {"created_from": created_from, "created_to": created_to},
            "readiness": readiness,
            "summary": readiness["reason_summary"],
            "metrics": {name: trend[name] for name in metric_names},
            "latest_experiment": trend["latest_experiment"],
            "latest_quality_gate_result": trend["latest_quality_gate_result"],
            "latest_baseline_comparison": trend["latest_baseline_comparison"],
            "warning_codes": self._warnings(project, trend),
        }
