from __future__ import annotations

from uuid import uuid4


def _create_experiments(client, count: int = 2):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"history-{uuid4()}", "name": "History Project", "description": "test"},
    ).json()["data"]
    dataset = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "history-dataset", "description": "test"},
    ).json()["data"]
    case = client.post(
        f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
        json={
            "case_key": "history-case",
            "question": "What is the policy?",
            "expected_summary": "Policy summary",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "HIGH",
            "required_for_release": True,
        },
    ).json()["data"]
    assert client.post(f"/api/v1/evaluation-cases/{case['id']}/approve").status_code == 200
    dataset_version = client.post(f"/api/v1/datasets/{dataset['id']}/versions").json()["data"]
    target = client.post(
        f"/api/v1/projects/{project['id']}/targets",
        json={
            "name": "history-target",
            "target_type": "MOCK",
            "config": {"fixed_response": {"text": "allowed"}},
        },
    ).json()["data"]
    target_version = client.post(f"/api/v1/targets/{target['id']}/versions").json()["data"]
    evaluator = client.post(
        f"/api/v1/projects/{project['id']}/evaluators",
        json={
            "name": "history-evaluator",
            "evaluator_type": "CONTAINS",
            "config": {"expected": "allowed", "case_sensitive": False},
        },
    ).json()["data"]
    evaluator_version = client.post(f"/api/v1/evaluators/{evaluator['id']}/versions").json()["data"]
    experiments = []
    for _ in range(count):
        response = client.post(
            "/api/v1/experiments",
            json={
                "dataset_version_id": dataset_version["id"],
                "target_version_id": target_version["id"],
                "evaluator_version_id": evaluator_version["id"],
            },
        )
        assert response.status_code == 201
        experiments.append(response.json()["data"])
    return project, experiments


def _run(client, experiment: dict) -> dict:
    response = client.post(f"/api/v1/experiments/{experiment['id']}/run")
    assert response.status_code == 200
    return response.json()["data"]


def test_history_empty_project_and_not_found(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"empty-{uuid4()}", "name": "Empty", "description": None},
    ).json()["data"]

    response = client.get(f"/api/v1/projects/{project['id']}/experiment-history")
    assert response.status_code == 200
    assert response.json()["data"] == []
    assert response.json()["meta"]["pagination"] == {"total": 0, "page": 1, "size": 20}

    missing = client.get(f"/api/v1/projects/{uuid4()}/experiment-history")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "PROJECT_NOT_FOUND"


def test_history_sort_pagination_filters_and_validation(client):
    project, experiments = _create_experiments(client, 2)
    completed = _run(client, experiments[0])

    descending = client.get(f"/api/v1/projects/{project['id']}/experiment-history?page=1&size=1")
    assert descending.status_code == 200
    assert descending.json()["meta"]["pagination"] == {"total": 2, "page": 1, "size": 1}
    assert descending.json()["data"][0]["experiment_id"] == experiments[1]["id"]

    ascending = client.get(
        f"/api/v1/projects/{project['id']}/experiment-history?sort=created_at_asc"
    )
    assert ascending.status_code == 200
    assert ascending.json()["data"][0]["experiment_id"] == completed["id"]

    completed_only = client.get(
        f"/api/v1/projects/{project['id']}/experiment-history?experiment_status=COMPLETED"
    )
    assert completed_only.status_code == 200
    assert [item["experiment_id"] for item in completed_only.json()["data"]] == [completed["id"]]
    assert completed_only.json()["data"][0]["pass_rate"] == "1"

    for query in ("page=0", "size=0", "size=101", "experiment_status=PENDING"):
        assert client.get(f"/api/v1/projects/{project['id']}/experiment-history?{query}").status_code == 422

    invalid_range = client.get(
        f"/api/v1/projects/{project['id']}/experiment-history"
        "?created_from=2026-07-22T12:00:00Z&created_to=2026-07-21T12:00:00Z"
    )
    assert invalid_range.status_code == 422
    assert invalid_range.json()["error"]["code"] == "INVALID_HISTORY_DATE_RANGE"


def test_history_latest_gate_and_current_comparison(client):
    project, experiments = _create_experiments(client, 2)
    baseline = _run(client, experiments[0])
    current = _run(client, experiments[1])

    policy = client.post(
        f"/api/v1/projects/{project['id']}/quality-gate-policies",
        json={"name": "history-gate", "minimum_pass_rate": 1},
    ).json()["data"]
    gate = client.post(
        f"/api/v1/quality-gate-policies/{policy['id']}/evaluate",
        json={"experiment_id": current["id"]},
    )
    assert gate.status_code == 200
    comparison = client.post(
        "/api/v1/baseline-comparisons",
        json={"baseline_experiment_id": baseline["id"], "current_experiment_id": current["id"]},
    )
    assert comparison.status_code == 201

    history = client.get(f"/api/v1/projects/{project['id']}/experiment-history")
    assert history.status_code == 200
    by_id = {item["experiment_id"]: item for item in history.json()["data"]}
    assert by_id[current["id"]]["quality_gate_result"]["result_id"] == gate.json()["data"]["id"]
    assert by_id[current["id"]]["baseline_comparison"]["comparison_id"] == comparison.json()["data"]["id"]
    assert by_id[baseline["id"]]["baseline_comparison"] is None

    assert client.get(
        f"/api/v1/projects/{project['id']}/experiment-history?gate_status=PASS"
    ).json()["meta"]["pagination"]["total"] == 1
    assert client.get(
        f"/api/v1/projects/{project['id']}/experiment-history?comparison_status=UNCHANGED"
    ).json()["meta"]["pagination"]["total"] == 1


def test_trend_summary_counts_rates_and_latest_items(client):
    project, experiments = _create_experiments(client, 2)
    completed = _run(client, experiments[0])

    summary = client.get(f"/api/v1/projects/{project['id']}/trend-summary")
    assert summary.status_code == 200
    data = summary.json()["data"]
    assert data["experiment_count"] == 2
    assert data["pending_experiment_count"] == 1
    assert data["completed_experiment_count"] == 1
    assert data["average_pass_rate"] == "1"
    assert data["first_pass_rate"] == "1"
    assert data["latest_pass_rate"] == "1"
    assert data["pass_rate_delta"] == "0"
    assert data["gate_missing_count"] == 2
    assert data["comparison_missing_count"] == 2
    assert data["latest_experiment"]["experiment_id"] == experiments[1]["id"]
    assert data["latest_quality_gate_result"] is None
    assert data["latest_baseline_comparison"] is None
    assert completed["status"] == "COMPLETED"


def test_trend_summary_empty_and_invalid_range(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"trend-{uuid4()}", "name": "Trend", "description": None},
    ).json()["data"]
    response = client.get(f"/api/v1/projects/{project['id']}/trend-summary")
    assert response.status_code == 200
    assert response.json()["data"]["experiment_count"] == 0
    assert response.json()["data"]["average_pass_rate"] is None

    invalid = client.get(
        f"/api/v1/projects/{project['id']}/trend-summary"
        "?created_from=2026-07-22T00:00:00Z&created_to=2026-07-21T00:00:00Z"
    )
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "INVALID_HISTORY_DATE_RANGE"
