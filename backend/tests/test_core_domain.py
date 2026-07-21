from __future__ import annotations

from uuid import uuid4


def test_project_slug_unique_constraint(client):
    r1 = client.post(
        "/api/v1/projects",
        json={"slug": "demo-project", "name": "Demo", "description": "first"},
    )
    assert r1.status_code == 201

    r2 = client.post(
        "/api/v1/projects",
        json={"slug": "demo-project", "name": "Demo 2", "description": "second"},
    )
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "DUPLICATE_SLUG"


def test_dataset_name_unique_within_project(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "Demo", "description": "x"},
    ).json()["data"]

    first = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "dataset", "description": "d1"},
    )
    assert first.status_code == 201

    second = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "dataset", "description": "d2"},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DUPLICATE_DATASET_NAME_IN_PROJECT"


def test_case_key_unique_within_dataset(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "Demo", "description": "x"},
    ).json()["data"]
    dataset = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "dataset", "description": "d"},
    ).json()["data"]

    first = client.post(
        f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
        json={
            "case_key": "case-1",
            "question": "Q?",
            "expected_summary": "S",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "MEDIUM",
            "required_for_release": False,
        },
    )
    assert first.status_code == 201

    second = client.post(
        f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
        json={
            "case_key": "case-1",
            "question": "Q2?",
            "expected_summary": "S2",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "MEDIUM",
            "required_for_release": False,
        },
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DUPLICATE_CASE_KEY_IN_DATASET"


def test_evaluation_case_transition_and_immutability(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "Flow", "description": "x"},
    ).json()["data"]
    dataset = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "dataset", "description": "d"},
    ).json()["data"]

    created = client.post(
        f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
        json={
            "case_key": "draft-case",
            "question": "Can draft edit?",
            "expected_summary": "ok",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "HIGH",
            "required_for_release": False,
        },
    ).json()["data"]

    patch_draft = client.patch(
        f"/api/v1/evaluation-cases/{created['id']}",
        json={"question": "edited"},
    )
    assert patch_draft.status_code == 200

    approve = client.post(f"/api/v1/evaluation-cases/{created['id']}/approve")
    assert approve.status_code == 200
    assert approve.json()["data"]["status"] == "APPROVED"

    patch_approved = client.patch(f"/api/v1/evaluation-cases/{created['id']}", json={"question": "nope"})
    assert patch_approved.status_code == 409
    assert patch_approved.json()["error"]["code"] == "RESOURCE_IMMUTABLE"

    dep = client.post(f"/api/v1/evaluation-cases/{created['id']}/deprecate")
    assert dep.status_code == 200
    assert dep.json()["data"]["status"] == "DEPRECATED"

    patch_deprecated = client.patch(f"/api/v1/evaluation-cases/{created['id']}", json={"question": "nope2"})
    assert patch_deprecated.status_code == 409
    assert patch_deprecated.json()["error"]["code"] == "RESOURCE_IMMUTABLE"

    dep_again = client.post(f"/api/v1/evaluation-cases/{created['id']}/deprecate")
    assert dep_again.status_code == 409
    assert dep_again.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


def test_inactive_project_blocks_dataset_create_and_updates(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "Inactive", "description": "x"},
    ).json()["data"]

    deactivate = client.patch(f"/api/v1/projects/{project['id']}", json={"is_active": False})
    assert deactivate.status_code == 200

    dataset_post = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "blocked", "description": "x"},
    )
    assert dataset_post.status_code == 409
    assert dataset_post.json()["error"]["code"] == "PROJECT_INACTIVE"

    patch = client.patch(f"/api/v1/projects/{project['id']}", json={"name": "blocked update"})
    assert patch.status_code == 409
    assert patch.json()["error"]["code"] == "PROJECT_INACTIVE"


def test_inactive_project_blocks_all_dataset_and_case_mutations(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "Inactive", "description": "x"},
    ).json()["data"]
    dataset = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "dataset", "description": "d"},
    ).json()["data"]
    created_case = client.post(
        f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
        json={
            "case_key": "case-1",
            "question": "Q?",
            "expected_summary": "S",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "MEDIUM",
            "required_for_release": False,
        },
    ).json()["data"]

    deactivate = client.patch(f"/api/v1/projects/{project['id']}", json={"is_active": False})
    assert deactivate.status_code == 200

    blocked_dataset_post = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "blocked-dataset", "description": "x"},
    )
    assert blocked_dataset_post.status_code == 409
    assert blocked_dataset_post.json()["error"]["code"] == "PROJECT_INACTIVE"

    blocked_dataset_patch = client.patch(f"/api/v1/datasets/{dataset['id']}", json={"name": "blocked"})
    assert blocked_dataset_patch.status_code == 409
    assert blocked_dataset_patch.json()["error"]["code"] == "PROJECT_INACTIVE"

    blocked_case_post = client.post(
        f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
        json={
            "case_key": "case-2",
            "question": "Q2",
            "expected_summary": "S2",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "MEDIUM",
            "required_for_release": False,
        },
    )
    assert blocked_case_post.status_code == 409
    assert blocked_case_post.json()["error"]["code"] == "PROJECT_INACTIVE"

    blocked_case_patch = client.patch(
        f"/api/v1/evaluation-cases/{created_case['id']}",
        json={"question": "blocked edit"},
    )
    assert blocked_case_patch.status_code == 409
    assert blocked_case_patch.json()["error"]["code"] == "PROJECT_INACTIVE"

    blocked_case_approve = client.post(f"/api/v1/evaluation-cases/{created_case['id']}/approve")
    assert blocked_case_approve.status_code == 409
    assert blocked_case_approve.json()["error"]["code"] == "PROJECT_INACTIVE"

    blocked_case_deprecate = client.post(f"/api/v1/evaluation-cases/{created_case['id']}/deprecate")
    assert blocked_case_deprecate.status_code == 409
    assert blocked_case_deprecate.json()["error"]["code"] == "PROJECT_INACTIVE"


def test_inactive_resources_cannot_be_reactivated(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "Reactive", "description": "x"},
    ).json()["data"]

    deactivate_project = client.patch(f"/api/v1/projects/{project['id']}", json={"is_active": False})
    assert deactivate_project.status_code == 200

    reactivate_project = client.patch(f"/api/v1/projects/{project['id']}", json={"is_active": True})
    assert reactivate_project.status_code == 409
    assert reactivate_project.json()["error"]["code"] == "INVALID_STATE_TRANSITION"

    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "Reactive DS", "description": "x"},
    ).json()["data"]
    dataset = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "dataset", "description": "d"},
    ).json()["data"]

    deactivate_dataset = client.patch(f"/api/v1/datasets/{dataset['id']}", json={"is_active": False})
    assert deactivate_dataset.status_code == 200

    reactivate_dataset = client.patch(f"/api/v1/datasets/{dataset['id']}", json={"is_active": True})
    assert reactivate_dataset.status_code == 409
    assert reactivate_dataset.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


def test_inactive_dataset_blocks_case_create_and_update(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "P", "description": "x"},
    ).json()["data"]
    dataset = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "dataset", "description": "d"},
    ).json()["data"]

    deactivate = client.patch(f"/api/v1/datasets/{dataset['id']}", json={"is_active": False})
    assert deactivate.status_code == 200

    case_post = client.post(
        f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
        json={
            "case_key": "case-1",
            "question": "x",
            "expected_summary": "y",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "LOW",
            "required_for_release": False,
        },
    )
    assert case_post.status_code == 409
    assert case_post.json()["error"]["code"] == "DATASET_INACTIVE"


def test_parent_not_found_cases(client):
    project_response = client.get("/api/v1/projects/00000000-0000-0000-0000-000000000000")
    assert project_response.status_code == 404
    assert project_response.json()["error"]["code"] == "PROJECT_NOT_FOUND"

    dataset_response = client.get("/api/v1/projects/00000000-0000-0000-0000-000000000000/datasets")
    assert dataset_response.status_code == 404

    dataset_post = client.post(
        "/api/v1/datasets/00000000-0000-0000-0000-000000000000/evaluation-cases",
        json={
            "case_key": "x",
            "question": "x",
            "expected_summary": "y",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "LOW",
            "required_for_release": False,
        },
    )
    assert dataset_post.status_code == 404
    assert dataset_post.json()["error"]["code"] == "DATASET_NOT_FOUND"
