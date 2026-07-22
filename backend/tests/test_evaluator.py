from __future__ import annotations

from uuid import uuid4



def _create_project(client):
    return client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "Evaluator Project", "description": "x"},
    ).json()["data"]


def _create_project_dataset_flow(client, evaluator_config=None):
    if evaluator_config is None:
        evaluator_config = {"expected": "A"}
    project = _create_project(client)
    evaluator = client.post(
        f"/api/v1/projects/{project['id']}/evaluators",
        json={
            "name": "contains-evaluator",
            "evaluator_type": "CONTAINS",
            "config": evaluator_config,
        },
    ).json()["data"]
    return project["id"], evaluator["id"]


def _create_case_evaluator_config(order_reversed=False):
    return {"expected": "7", "case_sensitive": False} if not order_reversed else {"case_sensitive": False, "expected": "7"}


def test_evaluator_crud_and_unique_name(client):
    project_id, evaluator_id = _create_project_dataset_flow(client)

    duplicate = client.post(
        f"/api/v1/projects/{project_id}/evaluators",
        json={"name": "contains-evaluator", "evaluator_type": "CONTAINS", "config": {"expected": "A"}},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "DUPLICATE_EVALUATOR_NAME_IN_PROJECT"

    patched = client.patch(
        f"/api/v1/evaluators/{evaluator_id}",
        json={"config": {"expected": "B"}},
    )
    assert patched.status_code == 200

    got = client.get(f"/api/v1/evaluators/{evaluator_id}")
    assert got.status_code == 200
    assert got.json()["data"]["config"] == {"expected": "B"}


def test_evaluator_name_unique_by_project_and_cross_project_scope(client):
    p1 = _create_project(client)
    p2 = _create_project(client)

    first = client.post(
        f"/api/v1/projects/{p1['id']}/evaluators",
        json={"name": "shared-name", "evaluator_type": "CONTAINS", "config": {"expected": "A"}},
    )
    assert first.status_code == 201

    second = client.post(
        f"/api/v1/projects/{p1['id']}/evaluators",
        json={"name": "shared-name", "evaluator_type": "REGEX", "config": {"pattern": "x"}},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DUPLICATE_EVALUATOR_NAME_IN_PROJECT"

    cross = client.post(
        f"/api/v1/projects/{p2['id']}/evaluators",
        json={"name": "shared-name", "evaluator_type": "NOT_CONTAINS", "config": {"forbidden": "x"}},
    )
    assert cross.status_code == 201


def test_unsupported_evaluator_type_rejected(client):
    project_id, _ = _create_project_dataset_flow(client)

    before = client.get(f"/api/v1/projects/{project_id}/evaluators").json()["data"]
    reject = client.post(
        f"/api/v1/projects/{project_id}/evaluators",
        json={"name": "external", "evaluator_type": "LLM", "config": {"x": "y"}},
    )
    assert reject.status_code == 422
    body = reject.json()
    assert "detail" in body
    assert isinstance(body["detail"], list)
    loc = [entry.get("loc", [])[-1] for entry in body["detail"] if isinstance(entry, dict) and entry.get("loc")]
    assert "evaluator_type" in loc

    after = client.get(f"/api/v1/projects/{project_id}/evaluators").json()["data"]
    assert len(after) == len(before)


def test_inactive_evaluator_name_reuse_is_blocked(client):
    project_id, evaluator_id = _create_project_dataset_flow(client)

    deactivate = client.patch(f"/api/v1/evaluators/{evaluator_id}", json={"is_active": False})
    assert deactivate.status_code == 200
    assert deactivate.json()["data"]["is_active"] is False

    recreate = client.post(
        f"/api/v1/projects/{project_id}/evaluators",
        json={"name": "contains-evaluator", "evaluator_type": "CONTAINS", "config": {"expected": "A"}},
    )
    assert recreate.status_code == 409
    assert recreate.json()["error"]["code"] == "DUPLICATE_EVALUATOR_NAME_IN_PROJECT"


def test_inactive_project_blocks_evaluator_create(client):
    project_id, _ = _create_project_dataset_flow(client)
    project_block = client.patch(f"/api/v1/projects/{project_id}", json={"is_active": False})
    assert project_block.status_code == 200

    blocked = client.post(
        f"/api/v1/projects/{project_id}/evaluators",
        json={"name": "blocked", "evaluator_type": "CONTAINS", "config": {"expected": "A"}},
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "PROJECT_INACTIVE"


def test_inactive_evaluator_update_is_blocked(client):
    _, evaluator_id = _create_project_dataset_flow(client)

    deactivate = client.patch(f"/api/v1/evaluators/{evaluator_id}", json={"is_active": False})
    assert deactivate.status_code == 200

    blocked_name = client.patch(f"/api/v1/evaluators/{evaluator_id}", json={"name": "blocked"})
    assert blocked_name.status_code == 409
    assert blocked_name.json()["error"]["code"] == "EVALUATOR_INACTIVE"

    blocked_config = client.patch(f"/api/v1/evaluators/{evaluator_id}", json={"config": {"expected": "changed"}})
    assert blocked_config.status_code == 409
    assert blocked_config.json()["error"]["code"] == "EVALUATOR_INACTIVE"

    blocked_combo = client.patch(
        f"/api/v1/evaluators/{evaluator_id}",
        json={"is_active": False, "name": "blocked"},
    )
    assert blocked_combo.status_code == 409
    assert blocked_combo.json()["error"]["code"] == "EVALUATOR_INACTIVE"

    blocked_reactivate = client.patch(f"/api/v1/evaluators/{evaluator_id}", json={"is_active": True})
    assert blocked_reactivate.status_code == 409
    assert blocked_reactivate.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


def test_evaluator_version_duplicate_hash_with_key_ordered_config(client):
    _, evaluator_id = _create_project_dataset_flow(client, evaluator_config=_create_case_evaluator_config(False))

    patch_1 = client.patch(f"/api/v1/evaluators/{evaluator_id}", json={"config": _create_case_evaluator_config(False)})
    assert patch_1.status_code == 200
    first = client.post(f"/api/v1/evaluators/{evaluator_id}/versions")
    assert first.status_code == 201

    patch_2 = client.patch(
        f"/api/v1/evaluators/{evaluator_id}",
        json={"config": _create_case_evaluator_config(True)},
    )
    assert patch_2.status_code == 200
    second = client.post(f"/api/v1/evaluators/{evaluator_id}/versions")
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DUPLICATE_EVALUATOR_VERSION"


def test_evaluator_version_list_and_lookup_not_found(client):
    _, evaluator_id = _create_project_dataset_flow(client)
    created = client.post(f"/api/v1/evaluators/{evaluator_id}/versions")
    assert created.status_code == 201
    version_id = created.json()["data"]["id"]

    response = client.get(f"/api/v1/evaluators/{evaluator_id}/versions?page=0")
    assert response.status_code == 422
    response = client.get(f"/api/v1/evaluators/{evaluator_id}/versions?size=0")
    assert response.status_code == 422
    response = client.get(f"/api/v1/evaluators/{evaluator_id}/versions?size=101")
    assert response.status_code == 422

    missing = client.get(f"/api/v1/evaluators/{evaluator_id}/versions/999")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "EVALUATOR_VERSION_NOT_FOUND"

    missing_by_id = client.get("/api/v1/evaluator-versions/00000000-0000-0000-0000-000000000000")
    assert missing_by_id.status_code == 404
    assert missing_by_id.json()["error"]["code"] == "EVALUATOR_VERSION_NOT_FOUND"

    by_id = client.get(f"/api/v1/evaluator-versions/{version_id}")
    assert by_id.status_code == 200
    assert by_id.json()["data"]["version"] == 1


def test_inactive_evaluator_version_blocked(client):
    _, evaluator_id = _create_project_dataset_flow(client)
    deactivate = client.patch(f"/api/v1/evaluators/{evaluator_id}", json={"is_active": False})
    assert deactivate.status_code == 200

    version = client.post(f"/api/v1/evaluators/{evaluator_id}/versions")
    assert version.status_code == 409
    assert version.json()["error"]["code"] == "EVALUATOR_INACTIVE"


def test_evaluator_execute_contains(client):
    project_id = _create_project(client)["id"]
    evaluator = client.post(
        f"/api/v1/projects/{project_id}/evaluators",
        json={
            "name": "contains-evaluator",
            "evaluator_type": "CONTAINS",
            "config": {"expected": "7", "case_sensitive": False},
        },
    ).json()["data"]
    evaluator_id = evaluator["id"]

    version = client.post(f"/api/v1/evaluators/{evaluator_id}/versions")
    assert version.status_code == 201
    version_id = version.json()["data"]["id"]

    pass_response = client.post(
        f"/api/v1/evaluator-versions/{version_id}/execute",
        json={"output": {"text": "7일 이내로 안내합니다."}},
    )
    assert pass_response.status_code == 200
    pass_payload = pass_response.json()["data"]
    assert pass_payload["status"] == "PASS"
    assert pass_payload["reason_code"] is None
    assert pass_payload["reason"] is None

    fail_response = client.post(
        f"/api/v1/evaluator-versions/{version_id}/execute",
        json={"output": {"text": "처리가 불가능합니다."}},
    )
    assert fail_response.status_code == 200
    fail_payload = fail_response.json()["data"]
    assert fail_payload["status"] == "FAIL"
    assert fail_payload["reason_code"] == "EXPECTED_TEXT_NOT_FOUND"


def test_evaluator_execute_not_contains(client):
    project_id = _create_project(client)["id"]
    evaluator = client.post(
        f"/api/v1/projects/{project_id}/evaluators",
        json={
            "name": "not-contains-evaluator",
            "evaluator_type": "NOT_CONTAINS",
            "config": {"forbidden": "안됨", "case_sensitive": False},
        },
    ).json()["data"]
    evaluator_id = evaluator["id"]

    version = client.post(f"/api/v1/evaluators/{evaluator_id}/versions")
    assert version.status_code == 201
    version_id = version.json()["data"]["id"]

    fail_response = client.post(
        f"/api/v1/evaluator-versions/{version_id}/execute",
        json={"output": {"text": "이 작업은 안됨으로 처리됩니다."}},
    )
    assert fail_response.status_code == 200
    fail_payload = fail_response.json()["data"]
    assert fail_payload["status"] == "FAIL"
    assert fail_payload["reason_code"] == "FORBIDDEN_TEXT_FOUND"

    pass_response = client.post(
        f"/api/v1/evaluator-versions/{version_id}/execute",
        json={"output": {"text": "이 작업은 완료됩니다."}},
    )
    assert pass_response.status_code == 200
    pass_payload = pass_response.json()["data"]
    assert pass_payload["status"] == "PASS"
    assert pass_payload["reason_code"] is None


def test_evaluator_execute_regex(client):
    project_id = _create_project(client)["id"]
    evaluator = client.post(
        f"/api/v1/projects/{project_id}/evaluators",
        json={
            "name": "regex-evaluator",
            "evaluator_type": "REGEX",
            "config": {"pattern": r"\d+", "flags": ["IGNORECASE"]},
        },
    ).json()["data"]
    evaluator_id = evaluator["id"]

    version = client.post(f"/api/v1/evaluators/{evaluator_id}/versions")
    assert version.status_code == 201
    version_id = version.json()["data"]["id"]

    regex_pass = client.post(
        f"/api/v1/evaluator-versions/{version_id}/execute",
        json={"output": {"text": "번호 123개."}},
    )
    assert regex_pass.status_code == 200
    assert regex_pass.json()["data"]["status"] == "PASS"


def test_evaluator_execute_validation_and_config_errors(client):
    _, evaluator_id = _create_project_dataset_flow(client, evaluator_config={"expected": "A", "case_sensitive": False})
    version = client.post(f"/api/v1/evaluators/{evaluator_id}/versions")
    assert version.status_code == 201
    version_id = version.json()["data"]["id"]

    invalid_output = client.post(
        f"/api/v1/evaluator-versions/{version_id}/execute",
        json={"output": {}},
    )
    assert invalid_output.status_code == 422

    bad_config = client.patch(
        f"/api/v1/evaluators/{evaluator_id}",
        json={"config": {"expected": "", "case_sensitive": False}},
    )
    assert bad_config.status_code == 200
    bad_version = client.post(f"/api/v1/evaluators/{evaluator_id}/versions")
    assert bad_version.status_code == 201
    bad_version_id = bad_version.json()["data"]["id"]

    evaluated = client.post(
        f"/api/v1/evaluator-versions/{bad_version_id}/execute",
        json={"output": {"text": "abc"}},
    )
    assert evaluated.status_code == 409
    assert evaluated.json()["error"]["code"] == "INVALID_EVALUATOR_CONFIGURATION"

    bad_flag = client.patch(
        f"/api/v1/evaluators/{evaluator_id}",
        json={"config": {"pattern": r"\\d+", "flags": ["INVALID"]}},
    )
    assert bad_flag.status_code == 200
    bad_flag_version = client.post(f"/api/v1/evaluators/{evaluator_id}/versions")
    assert bad_flag_version.status_code == 201
    bad_flag_version_id = bad_flag_version.json()["data"]["id"]

    bad_eval = client.post(
        f"/api/v1/evaluator-versions/{bad_flag_version_id}/execute",
        json={"output": {"text": "abc"}},
    )
    assert bad_eval.status_code == 409
    assert bad_eval.json()["error"]["code"] == "INVALID_EVALUATOR_CONFIGURATION"
