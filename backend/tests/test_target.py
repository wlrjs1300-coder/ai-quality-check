from __future__ import annotations

import asyncio
import os
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.domain.models import TargetVersion


def _create_project_dataset_flow(client, target_config=None):
    if target_config is None:
        target_config = {"name": "mock"}
    project = client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "TargetFlow", "description": "x"},
    ).json()["data"]
    target = client.post(
        f"/api/v1/projects/{project['id']}/targets",
        json={"name": "mock-target", "target_type": "MOCK", "config": target_config},
    ).json()["data"]
    return project["id"], target["id"]


def _create_project(client):
    return client.post(
        "/api/v1/projects",
        json={"slug": f"project-{uuid4()}", "name": "TargetProject", "description": "x"},
    ).json()["data"]


def _update_target_version_field(version_id, field, value):
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise AssertionError("DATABASE_URL is required for this test")

    engine = create_async_engine(db_url, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    resolved_version_id = version_id if isinstance(version_id, UUID) else UUID(str(version_id))

    async def _update() -> None:
        try:
            async with session_factory() as session:
                target_version = await session.get(TargetVersion, resolved_version_id)
                assert target_version is not None
                if field in ("version", "id", "target_id"):
                    raise AssertionError("Unexpected field for helper update.")
                setattr(target_version, field, value)
                await session.commit()
        finally:
            await engine.dispose()

    asyncio.run(_update())


def test_target_crud_and_unique_name(client):
    project_id, target_id = _create_project_dataset_flow(client)

    second = client.post(
        f"/api/v1/projects/{project_id}/targets",
        json={"name": "mock-target", "target_type": "MOCK", "config": {}},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DUPLICATE_TARGET_NAME_IN_PROJECT"

    patched = client.patch(f"/api/v1/targets/{target_id}", json={"config": {"mode": "mock-v2"}})
    assert patched.status_code == 200

    got = client.get(f"/api/v1/targets/{target_id}")
    assert got.status_code == 200
    assert got.json()["data"]["config"] == {"mode": "mock-v2"}


def test_target_list_and_versions(client):
    _, target_id = _create_project_dataset_flow(client)

    first = client.post(f"/api/v1/targets/{target_id}/versions")
    assert first.status_code == 201
    version_id = first.json()["data"]["id"]

    second = client.post(f"/api/v1/targets/{target_id}/versions")
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DUPLICATE_TARGET_VERSION"

    get_v = client.get(f"/api/v1/targets/{target_id}/versions/{1}")
    assert get_v.status_code == 200
    assert get_v.json()["data"]["id"] == version_id

    list_res = client.get(f"/api/v1/targets/{target_id}/versions")
    assert list_res.status_code == 200
    assert list_res.json()["meta"]["pagination"]["total"] == 1

    version_id = first.json()["data"]["id"]
    by_id = client.get(f"/api/v1/target-versions/{version_id}")
    assert by_id.status_code == 200
    assert by_id.json()["data"]["id"] == version_id
    assert by_id.json()["data"]["latency_ms"] == 0
    assert by_id.json()["data"]["failure_rate"] == 0.0
    assert by_id.json()["data"]["response_strategy"] == "FIXED"


def test_unsupported_target_type_rejected(client):
    project_id, _ = _create_project_dataset_flow(client)

    before = client.get(f"/api/v1/projects/{project_id}/targets").json()["data"]

    reject = client.post(
        f"/api/v1/projects/{project_id}/targets",
        json={"name": "external", "target_type": "EXTERNAL", "config": {}},
    )
    assert reject.status_code == 422
    body = reject.json()
    assert "detail" in body
    assert isinstance(body["detail"], list)
    assert body["detail"]
    loc_target_type = [
        d.get("loc")
        for d in body["detail"]
        if isinstance(d, dict) and "loc" in d and d.get("loc") and d["loc"][-1] == "target_type"
    ]
    assert loc_target_type

    after = client.get(f"/api/v1/projects/{project_id}/targets").json()["data"]
    assert len(after) == len(before)


def test_target_name_unique_by_project_and_cross_project_scope(client):
    p1 = _create_project(client)
    p2 = _create_project(client)

    first = client.post(
        f"/api/v1/projects/{p1['id']}/targets",
        json={"name": "shared-name", "target_type": "MOCK", "config": {}},
    )
    assert first.status_code == 201

    second = client.post(
        f"/api/v1/projects/{p1['id']}/targets",
        json={"name": "shared-name", "target_type": "MOCK", "config": {}},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DUPLICATE_TARGET_NAME_IN_PROJECT"

    cross = client.post(
        f"/api/v1/projects/{p2['id']}/targets",
        json={"name": "shared-name", "target_type": "MOCK", "config": {}},
    )
    assert cross.status_code == 201


def test_inactive_target_name_reuse_is_blocked(client):
    project_id, target_id = _create_project_dataset_flow(client)

    deactivate = client.patch(f"/api/v1/targets/{target_id}", json={"is_active": False})
    assert deactivate.status_code == 200
    assert deactivate.json()["data"]["is_active"] is False

    recreate = client.post(
        f"/api/v1/projects/{project_id}/targets",
        json={"name": "mock-target", "target_type": "MOCK", "config": {}},
    )
    assert recreate.status_code == 409
    assert recreate.json()["error"]["code"] == "DUPLICATE_TARGET_NAME_IN_PROJECT"


def test_inactive_project_blocks_target_create(client):
    project_id, _ = _create_project_dataset_flow(client)
    project_block = client.patch(f"/api/v1/projects/{project_id}", json={"is_active": False})
    assert project_block.status_code == 200

    blocked = client.post(
        f"/api/v1/projects/{project_id}/targets",
        json={"name": "mock-blocked", "target_type": "MOCK", "config": {}},
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "PROJECT_INACTIVE"


def test_inactive_target_update_is_blocked(client):
    _, target_id = _create_project_dataset_flow(client)

    deactivate = client.patch(f"/api/v1/targets/{target_id}", json={"is_active": False})
    assert deactivate.status_code == 200

    blocked_name = client.patch(f"/api/v1/targets/{target_id}", json={"name": "blocked"})
    assert blocked_name.status_code == 409
    assert blocked_name.json()["error"]["code"] == "TARGET_INACTIVE"

    blocked_config = client.patch(f"/api/v1/targets/{target_id}", json={"config": {"v": 2}})
    assert blocked_config.status_code == 409
    assert blocked_config.json()["error"]["code"] == "TARGET_INACTIVE"

    blocked_combo = client.patch(f"/api/v1/targets/{target_id}", json={"is_active": False, "name": "blocked"})
    assert blocked_combo.status_code == 409
    assert blocked_combo.json()["error"]["code"] == "TARGET_INACTIVE"

    blocked_reactivate = client.patch(f"/api/v1/targets/{target_id}", json={"is_active": True})
    assert blocked_reactivate.status_code == 409
    assert blocked_reactivate.json()["error"]["code"] == "INVALID_STATE_TRANSITION"


def test_inactive_target_version_blocked(client):
    _, target_id = _create_project_dataset_flow(client)

    deactivate = client.patch(f"/api/v1/targets/{target_id}", json={"is_active": False})
    assert deactivate.status_code == 200

    version = client.post(f"/api/v1/targets/{target_id}/versions")
    assert version.status_code == 409
    assert version.json()["error"]["code"] == "TARGET_INACTIVE"


def test_target_version_duplicate_hash_with_key_ordered_config(client):
    _, target_id = _create_project_dataset_flow(client)

    patch_1 = client.patch(
        f"/api/v1/targets/{target_id}",
        json={"config": {"a": "x", "b": "y"}},
    )
    assert patch_1.status_code == 200

    first = client.post(f"/api/v1/targets/{target_id}/versions")
    assert first.status_code == 201

    patch_2 = client.patch(
        f"/api/v1/targets/{target_id}",
        json={"config": {"b": "y", "a": "x"}},
    )
    assert patch_2.status_code == 200

    second = client.post(f"/api/v1/targets/{target_id}/versions")
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "DUPLICATE_TARGET_VERSION"


def test_target_version_pagination_validation_and_not_found(client):
    _, target_id = _create_project_dataset_flow(client)

    response = client.get(f"/api/v1/targets/{target_id}/versions?page=0")
    assert response.status_code == 422
    response = client.get(f"/api/v1/targets/{target_id}/versions?size=0")
    assert response.status_code == 422
    response = client.get(f"/api/v1/targets/{target_id}/versions?size=101")
    assert response.status_code == 422

    missing_target = client.get("/api/v1/targets/00000000-0000-0000-0000-000000000000")
    assert missing_target.status_code == 404
    assert missing_target.json()["error"]["code"] == "TARGET_NOT_FOUND"

    missing_version = client.get("/api/v1/targets/00000000-0000-0000-0000-000000000000/versions/1")
    assert missing_version.status_code == 404
    assert missing_version.json()["error"]["code"] == "TARGET_VERSION_NOT_FOUND"

    missing_version_2 = client.get("/api/v1/target-versions/00000000-0000-0000-0000-000000000000")
    assert missing_version_2.status_code == 404
    assert missing_version_2.json()["error"]["code"] == "TARGET_VERSION_NOT_FOUND"


def test_target_update_duplicate_name_collision_handled_in_service_error(client):
    project_id, _ = _create_project_dataset_flow(client)
    other = client.post(
        f"/api/v1/projects/{project_id}/targets",
        json={"name": "other-target", "target_type": "MOCK", "config": {}},
    )
    assert other.status_code == 201
    target_b = other.json()["data"]["id"]

    patch = client.patch(f"/api/v1/targets/{target_b}", json={"name": "mock-target"})
    assert patch.status_code == 409
    assert patch.json()["error"]["code"] == "DUPLICATE_TARGET_NAME_IN_PROJECT"


def test_target_execute_fixed_version_returns_fixed_output(client):
    _, target_id = _create_project_dataset_flow(
        client,
        target_config={"fixed_response": {"text": "Fixed output"}},
    )
    version = client.post(f"/api/v1/targets/{target_id}/versions")
    assert version.status_code == 201
    version_id = version.json()["data"]["id"]

    executed = client.post(
        f"/api/v1/target-versions/{version_id}/execute",
        json={"input": {"question": "안녕하세요?"}},
    )
    assert executed.status_code == 200
    body = executed.json()
    assert body["data"]["target_version_id"] == version_id
    assert body["data"]["response_strategy"] == "FIXED"
    assert body["data"]["output"] == {"text": "Fixed output"}


def test_target_execute_validates_input_object(client):
    _, target_id = _create_project_dataset_flow(client)
    version = client.post(f"/api/v1/targets/{target_id}/versions")
    assert version.status_code == 201
    version_id = version.json()["data"]["id"]

    not_object = client.post(
        f"/api/v1/target-versions/{version_id}/execute",
        json={"input": "wrong"},
    )
    assert not_object.status_code == 422


def test_target_execute_rejects_non_fixed_response_strategy(client):
    _, target_id = _create_project_dataset_flow(
        client,
        target_config={"fixed_response": {"text": "Fixed output"}},
    )
    version = client.post(f"/api/v1/targets/{target_id}/versions")
    assert version.status_code == 201
    version_id = version.json()["data"]["id"]

    _update_target_version_field(version_id, "response_strategy", "CASE_BASED")
    rejected = client.post(
        f"/api/v1/target-versions/{version_id}/execute",
        json={"input": {"question": "질문"}},
    )
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "UNSUPPORTED_RESPONSE_STRATEGY"


def test_target_execute_rejects_invalid_fixed_response_config(client):
    _, target_id = _create_project_dataset_flow(
        client,
        target_config={"fixed_response": "broken"},
    )
    version = client.post(f"/api/v1/targets/{target_id}/versions")
    assert version.status_code == 201
    version_id = version.json()["data"]["id"]

    rejected = client.post(
        f"/api/v1/target-versions/{version_id}/execute",
        json={"input": {"question": "질문"}},
    )
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "INVALID_TARGET_CONFIGURATION"


def test_target_execute_not_found(client):
    not_found = client.post(
        "/api/v1/target-versions/00000000-0000-0000-0000-000000000000/execute",
        json={"input": {"question": "질문"}},
    )
    assert not_found.status_code == 404
    assert not_found.json()["error"]["code"] == "TARGET_VERSION_NOT_FOUND"
