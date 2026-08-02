from __future__ import annotations

import csv
import io
import json
from collections.abc import Iterator
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from urllib.parse import quote
from uuid import UUID
from itertools import chain

from src.application.services.history_service import ExperimentSort, HistoryService

CSV_EXPORT_ROW_LIMIT = 10_000
CSV_HEADER = (
    "experiment_id",
    "dataset_version_id",
    "target_version_id",
    "evaluator_version_id",
    "experiment_status",
    "total_case_count",
    "passed_case_count",
    "failed_case_count",
    "error_case_count",
    "pass_rate",
    "created_at",
    "started_at",
    "completed_at",
    "quality_gate_result_id",
    "quality_gate_policy_id",
    "quality_gate_status",
    "quality_gate_pass_rate",
    "quality_gate_reason_codes",
    "quality_gate_created_at",
    "baseline_comparison_id",
    "baseline_experiment_id",
    "baseline_comparison_status",
    "baseline_pass_rate_delta",
    "baseline_reason_codes",
    "baseline_comparison_created_at",
)


def protect_csv_text(value: str) -> str:
    stripped = value.lstrip(" ")
    if stripped and stripped[0] in ("=", "+", "-", "@", "\t", "\r", "\n"):
        return f"'{value}"
    return value


def _serialize(value: Any) -> str | int:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, int):
        return value
    if isinstance(value, list):
        return protect_csv_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
    return protect_csv_text(str(value))


def _csv_row(item: dict) -> tuple[str | int, ...]:
    gate = item["quality_gate_result"] or {}
    comparison = item["baseline_comparison"] or {}
    values = (
        item["experiment_id"],
        item["dataset_version_id"],
        item["target_version_id"],
        item["evaluator_version_id"],
        item["experiment_status"],
        item["total_case_count"],
        item["passed_case_count"],
        item["failed_case_count"],
        item["error_case_count"],
        item["pass_rate"],
        item["created_at"],
        item["started_at"],
        item["completed_at"],
        gate.get("result_id"),
        gate.get("policy_id"),
        gate.get("status"),
        gate.get("pass_rate"),
        gate.get("reason_codes"),
        gate.get("created_at"),
        comparison.get("comparison_id"),
        comparison.get("baseline_experiment_id"),
        comparison.get("status"),
        comparison.get("pass_rate_delta"),
        comparison.get("reason_codes"),
        comparison.get("created_at"),
    )
    return tuple(_serialize(value) for value in values)


def csv_chunks(items: list[dict]) -> Iterator[str]:
    yield "\ufeff"
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\r\n")
    for row in chain((CSV_HEADER,), (_csv_row(item) for item in items)):
        writer.writerow(row)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)


class HistoryCsvExportService:
    def __init__(self, history_service: HistoryService):
        self.history_service = history_service

    async def export(
        self,
        project_id: UUID,
        experiment_status: str | None = None,
        gate_status: str | None = None,
        comparison_status: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        sort: ExperimentSort = "created_at_desc",
    ) -> tuple[str, Iterator[str], int]:
        items = await self.history_service.list_history_for_export(
            project_id=project_id,
            row_limit=CSV_EXPORT_ROW_LIMIT,
            experiment_status=experiment_status,
            gate_status=gate_status,
            comparison_status=comparison_status,
            created_from=created_from,
            created_to=created_to,
            sort=sort,
        )
        date = datetime.now(timezone.utc).strftime("%Y%m%d")
        filename = f"project-{project_id}-experiment-history-{date}.csv"
        return filename, csv_chunks(items), len(items)


def content_disposition(filename: str) -> str:
    return f'attachment; filename="{filename}"; filename*=UTF-8\'\'{quote(filename)}'
