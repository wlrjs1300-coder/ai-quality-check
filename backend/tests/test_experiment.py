from __future__ import annotations

from uuid import uuid4

def _create_project_dataset_flow(client, question: str, answer: str):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "Experiment Project", "description": "x"},
    ).json()["data"]

    dataset = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "dataset", "description": "exp"},
    ).json()["data"]

    case = client.post(
        f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
        json={
            "case_key": f"case-{uuid4()}",
            "question": question,
            "expected_summary": "ok",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "MEDIUM",
            "required_for_release": False,
        },
    ).json()["data"]
    approve = client.post(f"/api/v1/evaluation-cases/{case['id']}/approve")
    assert approve.status_code == 200

    version = client.post(f"/api/v1/datasets/{dataset['id']}/versions")
    assert version.status_code == 201
    dataset_version_id = version.json()["data"]["id"]

    target = client.post(
        f"/api/v1/projects/{project['id']}/targets",
        json={
            "name": f"target-{uuid4()}",
            "target_type": "MOCK",
            "config": {"fixed_response": {"text": answer}},
        },
    ).json()["data"]
    target_version = client.post(f"/api/v1/targets/{target['id']}/versions")
    assert target_version.status_code == 201
    target_version_id = target_version.json()["data"]["id"]

    evaluator = client.post(
        f"/api/v1/projects/{project['id']}/evaluators",
        json={
            "name": f"eval-{uuid4()}",
            "evaluator_type": "CONTAINS",
            "config": {"expected": answer, "case_sensitive": False},
        },
    ).json()["data"]
    evaluator_version = client.post(f"/api/v1/evaluators/{evaluator['id']}/versions")
    assert evaluator_version.status_code == 201
    evaluator_version_id = evaluator_version.json()["data"]["id"]

    return {
        "project_id": project["id"],
        "dataset_version_id": dataset_version_id,
        "target_version_id": target_version_id,
        "evaluator_version_id": evaluator_version_id,
        "question": question,
    }


def test_experiment_create_and_get(client):
    flow = _create_project_dataset_flow(client, "환불은 7일 이내만 가능", "7")
    created = client.post(
        "/api/v1/experiments",
        json={
            "dataset_version_id": flow["dataset_version_id"],
            "target_version_id": flow["target_version_id"],
            "evaluator_version_id": flow["evaluator_version_id"],
        },
    )
    assert created.status_code == 201
    payload = created.json()["data"]
    assert payload["status"] == "CREATED"
    assert payload["total_cases"] == 1

    fetched = client.get(f"/api/v1/experiments/{payload['id']}")
    assert fetched.status_code == 200
    fetched_payload = fetched.json()["data"]
    assert fetched_payload["id"] == payload["id"]
    assert fetched_payload["status"] == "CREATED"


def test_experiment_run_saves_results_case_by_case(client):
    flow = _create_project_dataset_flow(client, "문의는 7일 이내에 처리", "7")
    created = client.post(
        "/api/v1/experiments",
        json={
            "dataset_version_id": flow["dataset_version_id"],
            "target_version_id": flow["target_version_id"],
            "evaluator_version_id": flow["evaluator_version_id"],
        },
    )
    assert created.status_code == 201
    experiment_id = created.json()["data"]["id"]

    run = client.post(f"/api/v1/experiments/{experiment_id}/run")
    assert run.status_code == 200
    body = run.json()["data"]
    assert body["status"] == "COMPLETED"
    assert body["pass_count"] == 1
    assert body["fail_count"] == 0
    assert body["error_count"] == 0

    results = client.get(f"/api/v1/experiments/{experiment_id}/results")
    assert results.status_code == 200
    body = results.json()
    assert body["meta"]["pagination"]["total"] == 1
    assert len(body["data"]) == 1
    result = body["data"][0]
    assert result["status"] == "PASS"
    assert result["input_snapshot"]["question"] == flow["question"]


def test_experiment_rejects_duplicate_run(client):
    flow = _create_project_dataset_flow(client, "조건은 7일", "7")
    created = client.post(
        "/api/v1/experiments",
        json={
            "dataset_version_id": flow["dataset_version_id"],
            "target_version_id": flow["target_version_id"],
            "evaluator_version_id": flow["evaluator_version_id"],
        },
    )
    assert created.status_code == 201
    experiment_id = created.json()["data"]["id"]

    first_run = client.post(f"/api/v1/experiments/{experiment_id}/run")
    assert first_run.status_code == 200
    second_run = client.post(f"/api/v1/experiments/{experiment_id}/run")
    assert second_run.status_code == 409
    assert second_run.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


def test_experiment_run_blocked_by_inactive_resources(client):
    flow = _create_project_dataset_flow(client, "조건은 7일", "7")
    created = client.post(
        "/api/v1/experiments",
        json={
            "dataset_version_id": flow["dataset_version_id"],
            "target_version_id": flow["target_version_id"],
            "evaluator_version_id": flow["evaluator_version_id"],
        },
    )
    assert created.status_code == 201
    created_payload = created.json()["data"]
    assert created_payload["status"] == "CREATED"

    # Invalidate evaluator and confirm runtime guard.
    evaluator_parent = client.get(f"/api/v1/evaluator-versions/{flow['evaluator_version_id']}").json()["data"]
    evaluator_parent_id = evaluator_parent["evaluator_id"]
    deactivate = client.patch(f"/api/v1/evaluators/{evaluator_parent_id}", json={"is_active": False})
    assert deactivate.status_code == 200

    run = client.post(f"/api/v1/experiments/{created_payload['id']}/run")
    assert run.status_code == 409
    assert run.json()["error"]["code"] == "EVALUATOR_INACTIVE"
