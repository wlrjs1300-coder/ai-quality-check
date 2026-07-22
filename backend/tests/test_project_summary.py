from __future__ import annotations

import asyncio
import os
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.domain.models import EvaluationResult, Experiment
from tests.test_history import _create_experiments, _run


def _mutate_experiment(
    experiment_id: str,
    *,
    experiment_status: str | None = None,
    result_status: str | None = None,
) -> None:
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _update() -> None:
        try:
            async with session_factory() as session:
                experiment = await session.get(Experiment, UUID(experiment_id))
                assert experiment is not None
                if experiment_status is not None:
                    experiment.status = experiment_status
                if result_status is not None:
                    result = (
                        await session.execute(
                            select(EvaluationResult).where(
                                EvaluationResult.experiment_id == experiment.id
                            )
                        )
                    ).scalar_one()
                    result.status = result_status
                    experiment.pass_count = int(result_status == "PASS")
                    experiment.fail_count = int(result_status == "FAIL")
                    experiment.error_count = int(result_status == "ERROR")
                await session.commit()
        finally:
            await engine.dispose()

    asyncio.run(_update())


def _create_gate(client, project_id: str, experiment_id: str) -> dict:
    policy = client.post(
        f"/api/v1/projects/{project_id}/quality-gate-policies",
        json={"name": f"summary-{uuid4()}", "minimum_pass_rate": 1},
    ).json()["data"]
    response = client.post(
        f"/api/v1/quality-gate-policies/{policy['id']}/evaluate",
        json={"experiment_id": experiment_id},
    )
    assert response.status_code == 200
    return response.json()["data"]


def test_empty_project_summary_is_unknown_with_ordered_warnings(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"summary-empty-{uuid4()}", "name": "Empty Summary", "description": None},
    ).json()["data"]

    response = client.get(f"/api/v1/projects/{project['id']}/summary-report")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["project"]["project_id"] == project["id"]
    assert data["readiness"] == {
        "status": "UNKNOWN",
        "reason_codes": ["NO_EXPERIMENTS"],
        "reason_summary": (
            "Release readiness cannot be determined because no completed experiment with a quality gate result is available."
        ),
    }
    assert data["summary"] == data["readiness"]["reason_summary"]
    assert data["warning_codes"] == [
        "PASS_RATE_UNAVAILABLE",
        "NO_QUALITY_GATE_HISTORY",
        "NO_BASELINE_HISTORY",
    ]
    assert data["metrics"]["experiment_count"] == 0
    assert data["latest_experiment"] is None


def test_created_running_and_failed_latest_experiment_readiness(client):
    project, experiments = _create_experiments(client, 1)
    endpoint = f"/api/v1/projects/{project['id']}/summary-report"

    created = client.get(endpoint).json()["data"]
    assert created["readiness"]["status"] == "UNKNOWN"
    assert created["readiness"]["reason_codes"] == ["LATEST_EXPERIMENT_NOT_COMPLETED"]

    _mutate_experiment(experiments[0]["id"], experiment_status="RUNNING")
    running = client.get(endpoint).json()["data"]
    assert running["readiness"]["status"] == "UNKNOWN"
    assert "RUNNING_EXPERIMENTS_PRESENT" in running["warning_codes"]

    _mutate_experiment(experiments[0]["id"], experiment_status="FAILED")
    failed = client.get(endpoint).json()["data"]
    assert failed["readiness"]["status"] == "NOT_READY"
    assert failed["readiness"]["reason_codes"] == ["LATEST_EXPERIMENT_FAILED"]
    assert "FAILED_EXPERIMENTS_PRESENT" in failed["warning_codes"]


def test_completed_without_gate_unknown_and_pass_gate_ready(client):
    project, experiments = _create_experiments(client, 1)
    completed = _run(client, experiments[0])
    endpoint = f"/api/v1/projects/{project['id']}/summary-report"

    without_gate = client.get(endpoint).json()["data"]
    assert without_gate["readiness"]["status"] == "UNKNOWN"
    assert without_gate["readiness"]["reason_codes"] == ["QUALITY_GATE_MISSING"]

    gate = _create_gate(client, project["id"], completed["id"])
    ready = client.get(endpoint).json()["data"]
    assert ready["readiness"]["status"] == "READY"
    assert ready["readiness"]["reason_codes"] == ["READY_FOR_RELEASE"]
    assert ready["latest_quality_gate_result"]["result_id"] == gate["id"]
    assert ready["latest_baseline_comparison"] is None
    assert ready["summary"] == (
        "The latest completed experiment passed the quality gate and no regression was detected."
    )


def test_blocked_gate_and_regression_are_not_ready(client):
    project, experiments = _create_experiments(client, 2)
    baseline = _run(client, experiments[0])
    current = _run(client, experiments[1])
    _mutate_experiment(current["id"], result_status="FAIL")

    comparison = client.post(
        "/api/v1/baseline-comparisons",
        json={"baseline_experiment_id": baseline["id"], "current_experiment_id": current["id"]},
    )
    assert comparison.status_code == 201
    assert comparison.json()["data"]["status"] == "REGRESSED"
    gate = _create_gate(client, project["id"], current["id"])
    assert gate["status"] == "BLOCK"

    data = client.get(f"/api/v1/projects/{project['id']}/summary-report").json()["data"]
    assert data["readiness"]["status"] == "NOT_READY"
    assert data["readiness"]["reason_codes"] == [
        "QUALITY_GATE_BLOCKED",
        "BASELINE_REGRESSION_PRESENT",
    ]
    assert data["warning_codes"] == [
        "GATE_BLOCK_HISTORY_PRESENT",
        "REGRESSION_HISTORY_PRESENT",
        "PASS_RATE_DECLINING",
    ]
    assert data["latest_baseline_comparison"]["status"] == "REGRESSED"
    assert data["metrics"]["pass_rate_delta"] == "-1"


def test_inactive_project_is_readable_and_warning_is_first(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"inactive-{uuid4()}", "name": "Inactive", "description": None},
    ).json()["data"]
    assert client.patch(
        f"/api/v1/projects/{project['id']}", json={"is_active": False}
    ).status_code == 200

    response = client.get(f"/api/v1/projects/{project['id']}/summary-report")
    assert response.status_code == 200
    assert response.json()["data"]["project"]["is_active"] is False
    assert response.json()["data"]["warning_codes"][0] == "PROJECT_INACTIVE"


def test_summary_matches_trend_and_period_validation(client):
    project, experiments = _create_experiments(client, 1)
    _run(client, experiments[0])
    summary = client.get(f"/api/v1/projects/{project['id']}/summary-report").json()["data"]
    trend = client.get(f"/api/v1/projects/{project['id']}/trend-summary").json()["data"]
    for key, value in summary["metrics"].items():
        assert value == trend[key]
    assert summary["latest_experiment"] == trend["latest_experiment"]

    future = client.get(
        f"/api/v1/projects/{project['id']}/summary-report"
        "?created_from=2099-01-01T00:00:00Z&created_to=2099-12-31T00:00:00Z"
    )
    assert future.status_code == 200
    assert future.json()["data"]["metrics"]["experiment_count"] == 0

    invalid = client.get(
        f"/api/v1/projects/{project['id']}/summary-report"
        "?created_from=2026-07-22T00:00:00Z&created_to=2026-07-21T00:00:00Z"
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "INVALID_HISTORY_DATE_RANGE"

    missing = client.get(f"/api/v1/projects/{uuid4()}/summary-report")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "PROJECT_NOT_FOUND"
