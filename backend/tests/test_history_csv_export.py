from __future__ import annotations

import asyncio
import csv
import io
import json
import re
from uuid import uuid4

import pytest

from src.application.errors import ErrorCodeError
from src.application.services.history_csv_export_service import (
    CSV_EXPORT_ROW_LIMIT,
    CSV_HEADER,
    csv_chunks,
    protect_csv_text,
)
from src.application.services.history_service import HistoryService
from tests.test_history import _create_experiments, _run


def _csv_rows(response) -> list[list[str]]:
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert response.content.count(b"\xef\xbb\xbf") == 1
    return list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"), newline="")))


def test_csv_export_empty_has_bom_header_and_safe_headers(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"csv-empty-{uuid4()}", "name": "CSV Empty", "description": None},
    ).json()["data"]

    response = client.get(f"/api/v1/projects/{project['id']}/experiment-history.csv")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    disposition = response.headers["content-disposition"]
    assert re.fullmatch(
        rf'attachment; filename="project-{project["id"]}-experiment-history-\d{{8}}\.csv"; '
        rf"filename\*=UTF-8''project-{project['id']}-experiment-history-\d{{8}}\.csv",
        disposition,
    )
    rows = _csv_rows(response)
    assert rows == [list(CSV_HEADER)]
    assert response.content.endswith(b"\r\n")


def test_csv_export_serializes_history_and_matches_sort(client):
    project, experiments = _create_experiments(client, 2)
    completed = _run(client, experiments[0])

    history = client.get(
        f"/api/v1/projects/{project['id']}/experiment-history?sort=created_at_asc"
    ).json()["data"]
    response = client.get(
        f"/api/v1/projects/{project['id']}/experiment-history.csv?sort=created_at_asc"
    )
    assert response.status_code == 200
    rows = _csv_rows(response)
    assert rows[0] == list(CSV_HEADER)
    assert [row[0] for row in rows[1:]] == [item["experiment_id"] for item in history]
    first = dict(zip(CSV_HEADER, rows[1]))
    assert first["experiment_id"] == completed["id"]
    assert first["dataset_version_id"] == completed["dataset_version_id"]
    assert first["pass_rate"] == "1"
    assert first["created_at"]
    assert "T" in first["created_at"]
    assert first["started_at"] == ""
    assert first["quality_gate_result_id"] == ""
    assert response.content.count(b"\r\n") == 3


def test_csv_export_reuses_status_filter_and_errors(client):
    project, experiments = _create_experiments(client, 2)
    completed = _run(client, experiments[0])
    response = client.get(
        f"/api/v1/projects/{project['id']}/experiment-history.csv?experiment_status=COMPLETED"
    )
    rows = _csv_rows(response)
    assert len(rows) == 2
    assert rows[1][0] == completed["id"]

    missing = client.get(f"/api/v1/projects/{uuid4()}/experiment-history.csv")
    assert missing.status_code == 404
    assert missing.headers["content-type"].startswith("application/json")
    assert missing.json()["error"]["code"] == "PROJECT_NOT_FOUND"

    invalid_range = client.get(
        f"/api/v1/projects/{project['id']}/experiment-history.csv"
        "?created_from=2026-07-22T12:00:00Z&created_to=2026-07-21T12:00:00Z"
    )
    assert invalid_range.status_code == 422
    assert invalid_range.json()["error"]["code"] == "INVALID_HISTORY_DATE_RANGE"
    assert client.get(
        f"/api/v1/projects/{project['id']}/experiment-history.csv?gate_status=UNKNOWN"
    ).status_code == 422


def test_csv_export_latest_gate_and_comparison_are_json_serialized(client):
    project, experiments = _create_experiments(client, 2)
    baseline = _run(client, experiments[0])
    current = _run(client, experiments[1])
    policy = client.post(
        f"/api/v1/projects/{project['id']}/quality-gate-policies",
        json={"name": "csv-gate", "minimum_pass_rate": 1},
    ).json()["data"]
    gate = client.post(
        f"/api/v1/quality-gate-policies/{policy['id']}/evaluate",
        json={"experiment_id": current["id"]},
    ).json()["data"]
    comparison = client.post(
        "/api/v1/baseline-comparisons",
        json={"baseline_experiment_id": baseline["id"], "current_experiment_id": current["id"]},
    ).json()["data"]

    rows = _csv_rows(
        client.get(f"/api/v1/projects/{project['id']}/experiment-history.csv")
    )
    by_id = {row[0]: dict(zip(CSV_HEADER, row)) for row in rows[1:]}
    assert by_id[current["id"]]["quality_gate_result_id"] == gate["id"]
    assert by_id[current["id"]]["quality_gate_reason_codes"] == "[]"
    assert by_id[current["id"]]["baseline_comparison_id"] == comparison["id"]
    assert by_id[current["id"]]["baseline_reason_codes"] == json.dumps(
        comparison["reason_codes"], ensure_ascii=False, separators=(",", ":")
    )
    assert by_id[baseline["id"]]["baseline_comparison_id"] == ""


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("=SUM(1,1)", "'=SUM(1,1)"),
        ("+cmd", "'+cmd"),
        ("-1+2", "'-1+2"),
        ("@value", "'@value"),
        ("\tvalue", "'\tvalue"),
        ("\rvalue", "'\rvalue"),
        ("\nvalue", "'\nvalue"),
        ("normal", "normal"),
    ],
)
def test_formula_injection_protection(value, expected):
    assert protect_csv_text(value) == expected


def test_csv_writer_quotes_special_reason_codes():
    item = {
        "experiment_id": uuid4(),
        "dataset_version_id": uuid4(),
        "target_version_id": uuid4(),
        "evaluator_version_id": uuid4(),
        "experiment_status": "COMPLETED",
        "total_case_count": 1,
        "passed_case_count": 1,
        "failed_case_count": 0,
        "error_case_count": 0,
        "pass_rate": None,
        "created_at": None,
        "started_at": None,
        "completed_at": None,
        "quality_gate_result": {
            "reason_codes": ["comma,value", 'quote"value', "line\nbreak"]
        },
        "baseline_comparison": None,
    }
    content = "".join(csv_chunks([item]))
    rows = list(csv.reader(io.StringIO(content.lstrip("\ufeff"), newline="")))
    assert rows[1][17] == '["comma,value","quote\\"value","line\\nbreak"]'


def test_csv_export_row_limit_error_contains_total_and_limit():
    service = HistoryService(db=None)  # type: ignore[arg-type]

    async def _list_history(**_kwargs):
        return [], CSV_EXPORT_ROW_LIMIT + 1

    service.list_history = _list_history  # type: ignore[method-assign]
    with pytest.raises(ErrorCodeError) as raised:
        asyncio.run(service.list_history_for_export(uuid4(), CSV_EXPORT_ROW_LIMIT))
    assert raised.value.code == "CSV_EXPORT_ROW_LIMIT_EXCEEDED"
    assert raised.value.status_code == 409
    assert raised.value.details == {"total": CSV_EXPORT_ROW_LIMIT + 1, "limit": CSV_EXPORT_ROW_LIMIT}
