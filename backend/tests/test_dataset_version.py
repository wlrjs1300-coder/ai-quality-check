from __future__ import annotations

from uuid import UUID
from uuid import uuid4
from types import SimpleNamespace

from src.application.services.dataset_version_service import _canonical_snapshot


def _create_project_dataset(client):
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "VerProj", "description": "x"},
    ).json()["data"]
    dataset = client.post(
        f"/api/v1/projects/{project['id']}/datasets",
        json={"name": "dataset", "description": "d"},
    ).json()["data"]
    return project["id"], dataset["id"]


def _create_case(client, dataset_id: UUID, payload: dict) -> dict:
    return client.post(
        f"/api/v1/datasets/{dataset_id}/evaluation-cases",
        json=payload,
    ).json()["data"]


def test_dataset_version_only_includes_approved_cases(client):
    _, dataset_id = _create_project_dataset(client)

    _create_case(
        client,
        dataset_id,
        {
            "case_key": "draft",
            "question": "draft Q",
            "expected_summary": "skip",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "LOW",
            "required_for_release": False,
        },
    )

    approved_case = _create_case(
        client,
        dataset_id,
        {
            "case_key": "approved",
            "question": "approved Q",
            "expected_summary": "ok",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "LOW",
            "required_for_release": False,
        },
    )
    approve_response = client.post(f"/api/v1/evaluation-cases/{approved_case['id']}/approve")
    assert approve_response.status_code == 200
    assert approve_response.json()["data"]["status"] == "APPROVED"

    deprecated = _create_case(
        client,
        dataset_id,
        {
            "case_key": "deprecated",
            "question": "to deprecate",
            "expected_summary": "tmp",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "LOW",
            "required_for_release": False,
        },
    )
    client.post(f"/api/v1/evaluation-cases/{deprecated['id']}/approve")
    client.post(f"/api/v1/evaluation-cases/{deprecated['id']}/deprecate")

    response = client.post(f"/api/v1/datasets/{dataset_id}/versions")
    assert response.status_code == 201
    version_id = response.json()["data"]["id"]

    get_response = client.get(f"/api/v1/datasets/{dataset_id}/versions/{1}")
    assert get_response.status_code == 200
    payload = get_response.json()["data"]
    assert payload["id"] == version_id
    assert payload["case_count"] == 1
    assert len(payload["cases"]) == 1
    assert payload["cases"][0]["case_key"] == "approved"


def test_create_dataset_version_block_when_no_approved_cases(client):
    _, dataset_id = _create_project_dataset(client)
    _create_case(
        client,
        dataset_id,
        {
            "case_key": "draft",
            "question": "draft Q",
            "expected_summary": "skip",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "LOW",
            "required_for_release": False,
        },
    )
    response = client.post(f"/api/v1/datasets/{dataset_id}/versions")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "NO_APPROVED_CASES"


def test_create_dataset_version_is_blocked_by_inactive_dataset(client):
    project_id, dataset_id = _create_project_dataset(client)

    drafted = _create_case(
        client,
        dataset_id,
        {
            "case_key": "case",
            "question": "q",
            "expected_summary": "x",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "LOW",
            "required_for_release": False,
        },
    )
    client.post(f"/api/v1/evaluation-cases/{drafted['id']}/approve")

    deactivate_dataset = client.patch(f"/api/v1/datasets/{dataset_id}", json={"is_active": False})
    assert deactivate_dataset.status_code == 200
    blocked = client.post(f"/api/v1/datasets/{dataset_id}/versions")
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "DATASET_INACTIVE"


def test_create_dataset_version_is_blocked_by_inactive_project(client):
    project_id, dataset_id = _create_project_dataset(client)

    drafted = _create_case(
        client,
        dataset_id,
        {
            "case_key": "case",
            "question": "q",
            "expected_summary": "x",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "LOW",
            "required_for_release": False,
        },
    )
    client.post(f"/api/v1/evaluation-cases/{drafted['id']}/approve")

    deactivate_project = client.patch(f"/api/v1/projects/{project_id}", json={"is_active": False})
    assert deactivate_project.status_code == 200
    blocked_project = client.post(f"/api/v1/datasets/{dataset_id}/versions")
    assert blocked_project.status_code == 409
    assert blocked_project.json()["error"]["code"] == "PROJECT_INACTIVE"


def test_dataset_version_number_and_duplicate_blocking(client):
    _, dataset_id = _create_project_dataset(client)

    def _approve(payload: dict) -> None:
        case = _create_case(client, dataset_id, payload)
        client.post(f"/api/v1/evaluation-cases/{case['id']}/approve")

    _approve(
        {
            "case_key": "case-1",
            "question": "q1",
            "expected_summary": "s1",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "LOW",
            "required_for_release": False,
        },
    )
    first = client.post(f"/api/v1/datasets/{dataset_id}/versions")
    assert first.status_code == 201
    first_version = first.json()["data"]
    assert first_version["version"] == 1

    _approve(
        {
            "case_key": "case-2",
            "question": "q2",
            "expected_summary": "s2",
            "evidence": [],
            "required_elements": [],
            "forbidden_elements": [],
            "tags": [],
            "severity": "LOW",
            "required_for_release": False,
        },
    )

    second = client.post(f"/api/v1/datasets/{dataset_id}/versions")
    assert second.status_code == 201
    assert second.json()["data"]["version"] == 2
    duplicate = client.post(f"/api/v1/datasets/{dataset_id}/versions")
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "DUPLICATE_DATASET_VERSION"
    assert "details" in duplicate.json()["error"]


def test_dataset_version_list_includes_pagination_meta(client):
    _, dataset_id = _create_project_dataset(client)

    for i in range(2):
        case = _create_case(
            client,
            dataset_id,
            {
                "case_key": f"case-{i}",
                "question": f"q-{i}",
                "expected_summary": "s",
                "evidence": [],
                "required_elements": [],
                "forbidden_elements": [],
                "tags": [],
                "severity": "LOW",
                "required_for_release": False,
            },
        )
        client.post(f"/api/v1/evaluation-cases/{case['id']}/approve")
        client.post(f"/api/v1/datasets/{dataset_id}/versions")

    listing = client.get(f"/api/v1/datasets/{dataset_id}/versions?page=1&size=1")
    assert listing.status_code == 200
    body = listing.json()
    assert body["meta"]["pagination"]["total"] >= 2
    assert body["meta"]["pagination"]["page"] == 1
    assert body["meta"]["pagination"]["size"] == 1
    assert len(body["data"]) == 1


def test_dataset_version_list_validates_pagination_query(client):
    _, dataset_id = _create_project_dataset(client)
    endpoint = f"/api/v1/datasets/{dataset_id}/versions"

    for query in ("page=0", "page=-1", "size=0", "size=101"):
        assert client.get(f"{endpoint}?{query}").status_code == 422

    for size in (1, 100):
        response = client.get(f"{endpoint}?page=1&size={size}")
        assert response.status_code == 200
        assert response.json()["meta"]["pagination"] == {
            "total": 0,
            "page": 1,
            "size": size,
        }


def test_dataset_version_endpoints_have_no_update_or_delete(client):
    _, dataset_id = _create_project_dataset(client)
    patch_response = client.patch(f"/api/v1/datasets/{dataset_id}/versions")
    assert patch_response.status_code in (405, 404)


def test_dataset_version_hash_is_deterministic_for_order_independence():
    case = SimpleNamespace(
        case_key="case-a",
        question="  질문  ",
        expected_summary="결과",
        evidence=[
            {"source_id": "B", "content": "2"},
            {"source_id": "A", "content": "10"},
        ],
        required_elements=[{"name": "x"}, {"name": "y"}, {"name": "x"}],
        forbidden_elements=[{"name": "z"}, {"name": "a"}],
        tags=[{"tag": "b"}, {"tag": "a"}],
        severity="MEDIUM",
        required_for_release=False,
    )
    case_duplicated = SimpleNamespace(
        case_key="case-a",
        question="질문",
        expected_summary="결과",
        evidence=[
            {"content": "10", "source_id": "A"},
            {"content": "2", "source_id": "B"},
        ],
        required_elements=[{"name": "y"}, {"name": "x"}],
        forbidden_elements=[{"name": "a"}, {"name": "z"}],
        tags=[{"tag": "a"}, {"tag": "b"}],
        severity="MEDIUM",
        required_for_release=False,
    )
    assert _canonical_snapshot([case]) == _canonical_snapshot([case_duplicated])
