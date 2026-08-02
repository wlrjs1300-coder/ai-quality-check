from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.application.services.dashboard_service import (
    TREND_SUMMARIES,
    ProjectDashboardOverviewService,
)
from src.domain.models import Experiment
from tests.test_history import _create_experiments, _run
from tests.test_project_summary import _create_gate, _mutate_experiment


def _set_same_created_at(experiment_ids: list[str]) -> None:
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _update() -> None:
        try:
            async with session_factory() as session:
                timestamp = datetime(2026, 7, 22, tzinfo=timezone.utc)
                for experiment_id in experiment_ids:
                    experiment = await session.get(Experiment, UUID(experiment_id))
                    assert experiment is not None
                    experiment.created_at = timestamp
                await session.commit()
        finally:
            await engine.dispose()

    asyncio.run(_update())


def test_empty_and_inactive_project_dashboard(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"dashboard-{uuid4()}", "name": "Dashboard", "description": None},
    ).json()["data"]
    endpoint = f"/api/v1/projects/{project['id']}/dashboard-overview"

    empty = client.get(endpoint)
    assert empty.status_code == 200
    data = empty.json()["data"]
    assert data["readiness"]["status"] == "UNKNOWN"
    assert data["kpis"]["experiment_count"] == 0
    assert data["kpis"]["latest_pass_rate"] is None
    assert data["recent_experiments"] == []
    assert data["trend"] == {
        "direction": "UNKNOWN",
        "first_pass_rate": None,
        "latest_pass_rate": None,
        "pass_rate_delta": None,
        "summary": "Pass rate trend is unavailable for the selected period.",
    }

    assert client.patch(f"/api/v1/projects/{project['id']}", json={"is_active": False}).status_code == 200
    inactive = client.get(endpoint)
    assert inactive.status_code == 200
    assert inactive.json()["data"]["warning_codes"][0] == "PROJECT_INACTIVE"


def test_dashboard_recent_experiments_are_limited_and_deterministic(client):
    project, experiments = _create_experiments(client, 6)
    experiment_ids = [item["id"] for item in experiments]
    _set_same_created_at(experiment_ids)

    response = client.get(f"/api/v1/projects/{project['id']}/dashboard-overview")
    assert response.status_code == 200
    recent = response.json()["data"]["recent_experiments"]
    assert len(recent) == 5
    assert [item["experiment_id"] for item in recent] == sorted(experiment_ids, reverse=True)[:5]


def test_dashboard_reuses_summary_and_connects_recent_results(client):
    project, experiments = _create_experiments(client, 2)
    baseline = _run(client, experiments[0])
    current = _run(client, experiments[1])
    gate = _create_gate(client, project["id"], current["id"])
    comparison = client.post(
        "/api/v1/baseline-comparisons",
        json={"baseline_experiment_id": baseline["id"], "current_experiment_id": current["id"]},
    )
    assert comparison.status_code == 201

    dashboard = client.get(f"/api/v1/projects/{project['id']}/dashboard-overview").json()["data"]
    summary = client.get(f"/api/v1/projects/{project['id']}/summary-report").json()["data"]
    assert dashboard["readiness"] == summary["readiness"]
    assert dashboard["warning_codes"] == summary["warning_codes"]
    assert dashboard["latest_quality_gate_result"] == summary["latest_quality_gate_result"]
    assert dashboard["latest_baseline_comparison"] == summary["latest_baseline_comparison"]
    assert dashboard["kpis"]["experiment_count"] == summary["metrics"]["experiment_count"]
    assert dashboard["kpis"]["average_pass_rate"] == summary["metrics"]["average_pass_rate"]
    assert dashboard["trend"]["direction"] == "STABLE"
    assert dashboard["trend"]["pass_rate_delta"] == "0"

    recent_by_id = {item["experiment_id"]: item for item in dashboard["recent_experiments"]}
    assert recent_by_id[current["id"]]["quality_gate_status"] == gate["status"]
    assert recent_by_id[current["id"]]["baseline_comparison_status"] == "UNCHANGED"
    assert recent_by_id[baseline["id"]]["baseline_comparison_status"] is None


@pytest.mark.parametrize(
    ("delta", "direction"),
    [
        (Decimal("0.1"), "IMPROVING"),
        (Decimal("0"), "STABLE"),
        (Decimal("-0.1"), "DECLINING"),
        (None, "UNKNOWN"),
    ],
)
def test_dashboard_trend_direction_templates(delta, direction):
    assert ProjectDashboardOverviewService._trend_direction(delta) == direction
    assert TREND_SUMMARIES[direction] in {
        "Project pass rate is improving over the selected period.",
        "Project pass rate is stable over the selected period.",
        "Project pass rate is declining over the selected period.",
        "Pass rate trend is unavailable for the selected period.",
    }


def test_dashboard_declining_kpis_and_period_errors(client):
    project, experiments = _create_experiments(client, 2)
    _run(client, experiments[0])
    current = _run(client, experiments[1])
    _mutate_experiment(current["id"], result_status="FAIL")

    endpoint = f"/api/v1/projects/{project['id']}/dashboard-overview"
    data = client.get(endpoint).json()["data"]
    assert data["kpis"]["completed_experiment_count"] == 2
    assert data["kpis"]["latest_pass_rate"] == "0"
    assert data["kpis"]["average_pass_rate"] == "0.5"
    assert data["kpis"]["pass_rate_delta"] == "-1"
    assert data["trend"]["direction"] == "DECLINING"
    assert data["trend"]["summary"] == "Project pass rate is declining over the selected period."

    future = client.get(
        endpoint + "?created_from=2099-01-01T00:00:00Z&created_to=2099-12-31T00:00:00Z"
    )
    assert future.status_code == 200
    assert future.json()["data"]["recent_experiments"] == []

    invalid = client.get(
        endpoint + "?created_from=2026-07-22T00:00:00Z&created_to=2026-07-21T00:00:00Z"
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "INVALID_HISTORY_DATE_RANGE"

    missing = client.get(f"/api/v1/projects/{uuid4()}/dashboard-overview")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "PROJECT_NOT_FOUND"
