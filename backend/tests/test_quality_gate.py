from __future__ import annotations

import asyncio
import os
from uuid import UUID, uuid4

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.domain.models import EvaluationResult, Experiment, QualityGatePolicy, QualityGateResult


def _mutate_experiment(experiment_id: str, *, experiment_status: str | None = None, result_status: str | None = None):
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
                            select(EvaluationResult).where(EvaluationResult.experiment_id == experiment.id)
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


def _remove_experiment_results(experiment_id: str):
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)

    async def _remove() -> None:
        try:
            async with engine.begin() as connection:
                await connection.execute(
                    delete(EvaluationResult).where(EvaluationResult.experiment_id == UUID(experiment_id))
                )
        finally:
            await engine.dispose()

    asyncio.run(_remove())


def _deactivate_policy(policy_id: str):
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _update() -> None:
        try:
            async with session_factory() as session:
                policy = await session.get(QualityGatePolicy, UUID(policy_id))
                assert policy is not None
                policy.is_active = False
                await session.commit()
        finally:
            await engine.dispose()

    asyncio.run(_update())


def _create_completed_experiment(
    client,
    *,
    answer: str,
    expected: str,
    required_for_release: bool = False,
    run_experiment: bool = True,
):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"gate-{uuid4()}", "name": "Gate Project", "description": "test"},
    ).json()["data"]
    dataset = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "gate-dataset", "description": "test"},
    ).json()["data"]
    case = client.post(
        f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
        json={
            "case_key": "gate-case",
            "question": "정책을 알려주세요.",
            "expected_summary": "정책 안내",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "HIGH",
            "required_for_release": required_for_release,
        },
    ).json()["data"]
    assert client.post(f"/api/v1/evaluation-cases/{case['id']}/approve").status_code == 200
    dataset_version = client.post(f"/api/v1/datasets/{dataset['id']}/versions").json()["data"]
    target = client.post(
        f"/api/v1/projects/{project['id']}/targets",
        json={"name": "gate-target", "target_type": "MOCK", "config": {"fixed_response": {"text": answer}}},
    ).json()["data"]
    target_version = client.post(f"/api/v1/targets/{target['id']}/versions").json()["data"]
    evaluator = client.post(
        f"/api/v1/projects/{project['id']}/evaluators",
        json={
            "name": "gate-evaluator",
            "evaluator_type": "CONTAINS",
            "config": {"expected": expected, "case_sensitive": False},
        },
    ).json()["data"]
    evaluator_version = client.post(f"/api/v1/evaluators/{evaluator['id']}/versions").json()["data"]
    experiment = client.post(
        "/api/v1/experiments",
        json={
            "dataset_version_id": dataset_version["id"],
            "target_version_id": target_version["id"],
            "evaluator_version_id": evaluator_version["id"],
        },
    ).json()["data"]
    if not run_experiment:
        return project, experiment
    run = client.post(f"/api/v1/experiments/{experiment['id']}/run")
    assert run.status_code == 200
    assert run.json()["data"]["status"] == "COMPLETED"
    return project, run.json()["data"]


def _create_policy(client, project_id: str, **overrides):
    payload = {
        "name": f"gate-{uuid4()}",
        "minimum_pass_rate": 1.0,
        "block_on_error": True,
        "block_on_required_case_failure": True,
    }
    payload.update(overrides)
    return client.post(f"/api/v1/projects/{project_id}/quality-gate-policies", json=payload)


def test_quality_gate_policy_create_defaults_and_get(client):
    project, _ = _create_completed_experiment(client, answer="7일", expected="7일")
    created = client.post(
        f"/api/v1/projects/{project['id']}/quality-gate-policies",
        json={"name": "default-release-gate", "minimum_pass_rate": 0.95},
    )
    assert created.status_code == 201
    body = created.json()["data"]
    assert body["block_on_error"] is True
    assert body["block_on_required_case_failure"] is True
    assert body["is_active"] is True

    fetched = client.get(f"/api/v1/quality-gate-policies/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["id"] == body["id"]


def test_quality_gate_policy_validation_and_project_guards(client):
    project, _ = _create_completed_experiment(client, answer="7일", expected="7일")
    for value in (-0.1, 1.1):
        response = _create_policy(client, project["id"], minimum_pass_rate=value)
        assert response.status_code == 422
    assert _create_policy(client, project["id"], name="   ").status_code == 422
    assert _create_policy(client, str(uuid4())).status_code == 404

    assert client.patch(f"/api/v1/projects/{project['id']}", json={"is_active": False}).status_code == 200
    inactive = _create_policy(client, project["id"])
    assert inactive.status_code == 409
    assert inactive.json()["error"]["code"] == "PROJECT_INACTIVE"


def test_quality_gate_policy_duplicate_name_is_blocked(client):
    project, _ = _create_completed_experiment(client, answer="7일", expected="7일")
    first = _create_policy(client, project["id"], name="release")
    assert first.status_code == 201
    duplicate = _create_policy(client, project["id"], name="release")
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "DUPLICATE_QUALITY_GATE_POLICY_NAME_IN_PROJECT"


def test_quality_gate_pass_and_result_lookup(client):
    project, experiment = _create_completed_experiment(client, answer="환불은 7일 이내", expected="7일")
    policy = _create_policy(client, project["id"]).json()["data"]
    evaluated = client.post(
        f"/api/v1/quality-gate-policies/{policy['id']}/evaluate",
        json={"experiment_id": experiment["id"]},
    )
    assert evaluated.status_code == 200
    result = evaluated.json()["data"]
    assert result["status"] == "PASS"
    assert float(result["pass_rate"]) == 1.0
    assert result["reason_codes"] == []
    assert result["reason_summary"] is None
    assert result["passed_case_count"] + result["failed_case_count"] + result["error_case_count"] == result["total_case_count"]

    fetched = client.get(f"/api/v1/quality-gate-results/{result['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["data"] == result


def test_quality_gate_blocks_low_pass_rate_and_required_case_failure(client):
    project, experiment = _create_completed_experiment(
        client,
        answer="기간 제한 없음",
        expected="7일",
        required_for_release=True,
    )
    assert experiment["fail_count"] == 1
    policy = _create_policy(client, project["id"]).json()["data"]
    evaluated = client.post(
        f"/api/v1/quality-gate-policies/{policy['id']}/evaluate",
        json={"experiment_id": experiment["id"]},
    )
    assert evaluated.status_code == 200
    result = evaluated.json()["data"]
    assert result["status"] == "BLOCK"
    assert result["pass_rate"] in (0, 0.0, "0.0000")
    assert result["required_case_failure_count"] == 1
    assert result["reason_codes"] == ["PASS_RATE_BELOW_THRESHOLD", "REQUIRED_CASE_FAILURE_PRESENT"]
    assert result["reason_summary"]


def test_quality_gate_required_case_option_can_be_disabled(client):
    project, experiment = _create_completed_experiment(
        client,
        answer="기간 제한 없음",
        expected="7일",
        required_for_release=True,
    )
    policy = _create_policy(
        client,
        project["id"],
        minimum_pass_rate=0,
        block_on_required_case_failure=False,
    ).json()["data"]
    evaluated = client.post(
        f"/api/v1/quality-gate-policies/{policy['id']}/evaluate",
        json={"experiment_id": experiment["id"]},
    )
    assert evaluated.status_code == 200
    assert evaluated.json()["data"]["status"] == "PASS"
    assert evaluated.json()["data"]["reason_codes"] == []


def test_quality_gate_error_result_policy_options(client):
    project, experiment = _create_completed_experiment(client, answer="7일", expected="7일")
    _mutate_experiment(experiment["id"], result_status="ERROR")

    blocking_policy = _create_policy(client, project["id"], minimum_pass_rate=0).json()["data"]
    blocked = client.post(
        f"/api/v1/quality-gate-policies/{blocking_policy['id']}/evaluate",
        json={"experiment_id": experiment["id"]},
    )
    assert blocked.status_code == 200
    assert blocked.json()["data"]["status"] == "BLOCK"
    assert blocked.json()["data"]["reason_codes"] == ["ERROR_RESULTS_PRESENT"]

    nonblocking_policy = _create_policy(
        client,
        project["id"],
        minimum_pass_rate=0,
        block_on_error=False,
    ).json()["data"]
    passed = client.post(
        f"/api/v1/quality-gate-policies/{nonblocking_policy['id']}/evaluate",
        json={"experiment_id": experiment["id"]},
    )
    assert passed.status_code == 200
    assert passed.json()["data"]["status"] == "PASS"
    assert passed.json()["data"]["reason_codes"] == []


def test_quality_gate_rejects_empty_results_and_inactive_policy(client):
    project, experiment = _create_completed_experiment(client, answer="7일", expected="7일")
    empty_policy = _create_policy(client, project["id"]).json()["data"]
    _remove_experiment_results(experiment["id"])
    empty = client.post(
        f"/api/v1/quality-gate-policies/{empty_policy['id']}/evaluate",
        json={"experiment_id": experiment["id"]},
    )
    assert empty.status_code == 409
    assert empty.json()["error"]["code"] == "EMPTY_EXPERIMENT_RESULTS"

    inactive_policy = _create_policy(client, project["id"]).json()["data"]
    _deactivate_policy(inactive_policy["id"])
    inactive = client.post(
        f"/api/v1/quality-gate-policies/{inactive_policy['id']}/evaluate",
        json={"experiment_id": experiment["id"]},
    )
    assert inactive.status_code == 409
    assert inactive.json()["error"]["code"] == "QUALITY_GATE_POLICY_INACTIVE"


def test_quality_gate_rejects_unfinished_mismatch_and_duplicate(client):
    project, completed = _create_completed_experiment(client, answer="7일", expected="7일")
    policy = _create_policy(client, project["id"]).json()["data"]

    _, other_experiment = _create_completed_experiment(client, answer="7일", expected="7일")
    mismatch = client.post(
        f"/api/v1/quality-gate-policies/{policy['id']}/evaluate",
        json={"experiment_id": other_experiment["id"]},
    )
    assert mismatch.status_code == 409
    assert mismatch.json()["error"]["code"] == "QUALITY_GATE_PROJECT_MISMATCH"

    first = client.post(
        f"/api/v1/quality-gate-policies/{policy['id']}/evaluate",
        json={"experiment_id": completed["id"]},
    )
    assert first.status_code == 200
    duplicate = client.post(
        f"/api/v1/quality-gate-policies/{policy['id']}/evaluate",
        json={"experiment_id": completed["id"]},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "QUALITY_GATE_ALREADY_EVALUATED"

    pending_flow_project, pending_experiment = _create_completed_experiment(
        client,
        answer="7일",
        expected="7일",
        run_experiment=False,
    )
    pending_policy = _create_policy(client, pending_flow_project["id"]).json()["data"]
    unfinished = client.post(
        f"/api/v1/quality-gate-policies/{pending_policy['id']}/evaluate",
        json={"experiment_id": pending_experiment["id"]},
    )
    assert unfinished.status_code == 409
    assert unfinished.json()["error"]["code"] == "EXPERIMENT_NOT_COMPLETED"

    assert client.get(f"/api/v1/quality-gate-results/{uuid4()}").status_code == 404
    assert client.get(f"/api/v1/quality-gate-policies/{uuid4()}").status_code == 404


def test_quality_gate_rejects_all_non_completed_experiment_states(client):
    project, experiment = _create_completed_experiment(client, answer="7일", expected="7일")
    policy = _create_policy(client, project["id"]).json()["data"]
    for status in ("CREATED", "RUNNING", "FAILED"):
        _mutate_experiment(experiment["id"], experiment_status=status)
        response = client.post(
            f"/api/v1/quality-gate-policies/{policy['id']}/evaluate",
            json={"experiment_id": experiment["id"]},
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "EXPERIMENT_NOT_COMPLETED"


def test_quality_gate_result_is_immutable_model():
    assert not hasattr(QualityGateResult, "updated_at")
