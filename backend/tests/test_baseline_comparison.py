from __future__ import annotations

import asyncio
import os
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.domain.models import BaselineComparison, BaselineComparisonCase, EvaluationResult, Experiment


def _create_experiment_pair(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"compare-{uuid4()}", "name": "Compare Project", "description": "test"},
    ).json()["data"]
    dataset = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "compare-dataset", "description": "test"},
    ).json()["data"]
    case = client.post(
        f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
        json={
            "case_key": "compare-case",
            "question": "환불 기간을 알려주세요.",
            "expected_summary": "환불 기간 안내",
            "evidence": [],
            "required_elements": [{"value": "7일"}],
            "forbidden_elements": [],
            "tags": [{"value": "refund"}],
            "severity": "HIGH",
            "required_for_release": True,
        },
    ).json()["data"]
    assert client.post(f"/api/v1/evaluation-cases/{case['id']}/approve").status_code == 200
    dataset_version = client.post(f"/api/v1/datasets/{dataset['id']}/versions").json()["data"]
    target = client.post(
        f"/api/v1/projects/{project['id']}/targets",
        json={
            "name": "compare-target",
            "target_type": "MOCK",
            "config": {"fixed_response": {"text": "환불은 7일 이내 가능합니다."}},
        },
    ).json()["data"]
    target_version = client.post(f"/api/v1/targets/{target['id']}/versions").json()["data"]
    evaluator = client.post(
        f"/api/v1/projects/{project['id']}/evaluators",
        json={
            "name": "compare-evaluator",
            "evaluator_type": "CONTAINS",
            "config": {"expected": "7일", "case_sensitive": False},
        },
    ).json()["data"]
    evaluator_version = client.post(f"/api/v1/evaluators/{evaluator['id']}/versions").json()["data"]

    experiments = []
    for _ in range(2):
        created = client.post(
            "/api/v1/experiments",
            json={
                "dataset_version_id": dataset_version["id"],
                "target_version_id": target_version["id"],
                "evaluator_version_id": evaluator_version["id"],
            },
        ).json()["data"]
        run = client.post(f"/api/v1/experiments/{created['id']}/run")
        assert run.status_code == 200
        experiments.append(run.json()["data"])
    return project, dataset_version, experiments[0], experiments[1]


def _set_result_status(experiment_id: str, status: str) -> None:
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _update() -> None:
        try:
            async with session_factory() as session:
                experiment = await session.get(Experiment, UUID(experiment_id))
                assert experiment is not None
                result = (
                    await session.execute(
                        select(EvaluationResult).where(EvaluationResult.experiment_id == experiment.id)
                    )
                ).scalar_one()
                result.status = status
                experiment.pass_count = int(status == "PASS")
                experiment.fail_count = int(status == "FAIL")
                experiment.error_count = int(status == "ERROR")
                await session.commit()
        finally:
            await engine.dispose()

    asyncio.run(_update())


def _delete_results(experiment_id: str) -> None:
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)

    async def _delete() -> None:
        try:
            async with engine.begin() as connection:
                await connection.execute(
                    delete(EvaluationResult).where(EvaluationResult.experiment_id == UUID(experiment_id))
                )
        finally:
            await engine.dispose()

    asyncio.run(_delete())


def _compare(client, baseline_id: str, current_id: str):
    return client.post(
        "/api/v1/baseline-comparisons",
        json={"baseline_experiment_id": baseline_id, "current_experiment_id": current_id},
    )


@pytest.mark.parametrize(
    ("baseline_status", "current_status", "change_status", "reason_code", "overall_status"),
    [
        ("PASS", "PASS", "UNCHANGED", "STATUS_UNCHANGED", "UNCHANGED"),
        ("FAIL", "FAIL", "UNCHANGED", "STATUS_UNCHANGED", "UNCHANGED"),
        ("ERROR", "ERROR", "UNCHANGED", "STATUS_UNCHANGED", "UNCHANGED"),
        ("FAIL", "PASS", "IMPROVED", "FAIL_TO_PASS", "IMPROVED"),
        ("ERROR", "FAIL", "IMPROVED", "ERROR_TO_FAIL", "IMPROVED"),
        ("ERROR", "PASS", "IMPROVED", "ERROR_TO_PASS", "IMPROVED"),
        ("PASS", "FAIL", "REGRESSED", "PASS_TO_FAIL", "REGRESSED"),
        ("PASS", "ERROR", "REGRESSED", "PASS_TO_ERROR", "REGRESSED"),
        ("FAIL", "ERROR", "REGRESSED", "FAIL_TO_ERROR", "REGRESSED"),
    ],
)
def test_case_change_matrix(
    client,
    baseline_status,
    current_status,
    change_status,
    reason_code,
    overall_status,
):
    _, _, baseline, current = _create_experiment_pair(client)
    _set_result_status(baseline["id"], baseline_status)
    _set_result_status(current["id"], current_status)

    response = _compare(client, baseline["id"], current["id"])
    assert response.status_code == 201
    comparison = response.json()["data"]
    assert comparison["status"] == overall_status
    expected_delta = int(current_status == "PASS") - int(baseline_status == "PASS")
    assert float(comparison["pass_rate_delta"]) == expected_delta

    cases = client.get(f"/api/v1/baseline-comparisons/{comparison['id']}/cases")
    assert cases.status_code == 200
    item = cases.json()["data"][0]
    assert item["change_status"] == change_status
    assert item["reason_code"] == reason_code


def test_comparison_create_get_duplicate_and_pagination(client):
    project, _, baseline, current = _create_experiment_pair(client)
    _set_result_status(baseline["id"], "FAIL")
    created = _compare(client, baseline["id"], current["id"])
    assert created.status_code == 201
    comparison = created.json()["data"]
    assert comparison["project_id"] == project["id"]
    assert comparison["status"] == "IMPROVED"
    assert comparison["reason_codes"] == ["CASE_IMPROVEMENT_PRESENT"]

    fetched = client.get(f"/api/v1/baseline-comparisons/{comparison['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["data"] == comparison
    listed = client.get(f"/api/v1/baseline-comparisons/{comparison['id']}/cases?page=1&size=1")
    assert listed.status_code == 200
    assert listed.json()["meta"]["pagination"] == {"total": 1, "page": 1, "size": 1}
    for query in ("page=0", "size=0", "size=101"):
        assert client.get(f"/api/v1/baseline-comparisons/{comparison['id']}/cases?{query}").status_code == 422

    duplicate = _compare(client, baseline["id"], current["id"])
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "BASELINE_COMPARISON_ALREADY_EXISTS"
    assert client.get(f"/api/v1/baseline-comparisons/{uuid4()}").status_code == 404
    assert client.get(f"/api/v1/baseline-comparisons/{uuid4()}/cases").status_code == 404


def test_comparison_rejects_missing_same_unfinished_and_empty(client):
    _, _, baseline, current = _create_experiment_pair(client)
    missing_baseline = _compare(client, str(uuid4()), current["id"])
    assert missing_baseline.status_code == 404
    assert missing_baseline.json()["error"]["code"] == "BASELINE_EXPERIMENT_NOT_FOUND"
    missing_current = _compare(client, baseline["id"], str(uuid4()))
    assert missing_current.status_code == 404
    assert missing_current.json()["error"]["code"] == "CURRENT_EXPERIMENT_NOT_FOUND"
    same = _compare(client, baseline["id"], baseline["id"])
    assert same.status_code == 409
    assert same.json()["error"]["code"] == "BASELINE_COMPARISON_SAME_EXPERIMENT"

    for experiment, code in (
        (baseline, "BASELINE_EXPERIMENT_NOT_COMPLETED"),
        (current, "CURRENT_EXPERIMENT_NOT_COMPLETED"),
    ):
        _set_experiment_status(experiment["id"], "FAILED")
        response = _compare(client, baseline["id"], current["id"])
        assert response.status_code == 409
        assert response.json()["error"]["code"] == code
        _set_experiment_status(experiment["id"], "COMPLETED")

    _delete_results(baseline["id"])
    empty = _compare(client, baseline["id"], current["id"])
    assert empty.status_code == 409
    assert empty.json()["error"]["code"] == "EMPTY_EXPERIMENT_RESULTS"


def _set_experiment_status(experiment_id: str, status: str) -> None:
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _update() -> None:
        try:
            async with session_factory() as session:
                experiment = await session.get(Experiment, UUID(experiment_id))
                assert experiment is not None
                experiment.status = status
                await session.commit()
        finally:
            await engine.dispose()

    asyncio.run(_update())


def test_comparison_results_are_immutable_models():
    assert not hasattr(BaselineComparison, "updated_at")
    assert not hasattr(BaselineComparisonCase, "updated_at")
