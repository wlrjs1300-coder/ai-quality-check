from __future__ import annotations

from collections.abc import AsyncGenerator
import asyncio
from types import SimpleNamespace
import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.api.deps import get_db_session
from src.api.main import app
from src.application.errors import ErrorCodeError
from src.application.schemas import BaselineComparisonCreateRequest
from src.application.services import (
    BaselineComparisonService,
    DatasetService,
    DatasetVersionService,
    EvaluationCaseService,
    ProjectService,
)
from src.domain.models import CaseSeverity


def _get_postgres_url() -> str | None:
    return os.environ.get("TEST_DATABASE_URL")


def _postgres_url_for_sync(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql+psycopg://")


def _ensure_test_database_name(url: str) -> None:
    database_name = url.rsplit("/", 1)[-1].split("?")[0]
    assert "test" in database_name.lower(), f"Refusing PostgreSQL integration tests for database '{database_name}'."


def _run_alembic(args: list[str], env: dict[str, str], label: str) -> None:
    completed = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=Path(__file__).resolve().parent.parent,
        capture_output=True,
        text=True,
        env=env,
    )
    if completed.returncode != 0:
        stderr = completed.stderr or ""
        assert completed.returncode == 0, f"{label}: {stderr}"


def _db_connection(url: str):
    return create_engine(_postgres_url_for_sync(url), future=True)


def _payload(**values):
    return SimpleNamespace(**values)


def test_postgresql_alembic_upgrade_downgrade_and_constraints():
    url = _get_postgres_url()
    if not url or not url.startswith("postgresql"):
        pytest.skip("TEST_DATABASE_URL is not set for PostgreSQL integration test.")
    _ensure_test_database_name(url)

    env = os.environ.copy()
    env["DATABASE_URL"] = url

    _run_alembic(["upgrade", "head"], env, "alembic upgrade head")
    _run_alembic(["downgrade", "base"], env, "alembic downgrade base")
    _run_alembic(["upgrade", "head"], env, "alembic upgrade head")

    with _db_connection(url).connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'dataset_version_cases'
                  AND column_name IN ('evidence', 'required_elements', 'forbidden_elements', 'tags')
                ORDER BY column_name
                """
            )
        ).mappings().all()
        assert rows
        for row in rows:
            assert row["data_type"] == "jsonb"

        unique_constraints = set(
            connection.execute(
                text(
                    """
                    SELECT conname
                    FROM pg_constraint
                    WHERE conrelid IN (
                        'projects'::regclass,
                        'datasets'::regclass,
                        'evaluation_cases'::regclass,
                        'dataset_versions'::regclass,
                        'dataset_version_cases'::regclass,
                        'evaluators'::regclass,
                        'evaluator_versions'::regclass,
                        'quality_gate_policies'::regclass,
                        'quality_gate_results'::regclass,
                        'baseline_comparisons'::regclass,
                        'baseline_comparison_cases'::regclass
                    )
                      AND contype = 'u'
                    """
                )
            ).scalars().all()
        )
        assert "uq_projects_slug" in unique_constraints
        assert "uq_datasets_project_name" in unique_constraints
        assert "uq_evaluation_cases_dataset_case_key" in unique_constraints
        assert "uq_dataset_versions_dataset_version" in unique_constraints
        assert "uq_dataset_versions_dataset_content_hash" in unique_constraints
        assert "uq_dataset_version_cases_version_case_key" in unique_constraints
        assert "uq_evaluators_project_name" in unique_constraints
        assert "uq_evaluator_versions_evaluator_version" in unique_constraints
        assert "uq_evaluator_versions_evaluator_content_hash" in unique_constraints
        assert "uq_quality_gate_policies_project_name" in unique_constraints
        assert "uq_quality_gate_results_policy_experiment" in unique_constraints
        assert "uq_baseline_comparisons_experiment_pair" in unique_constraints
        assert "uq_baseline_comparison_cases_comparison_case" in unique_constraints

        check_constraints = set(
            connection.execute(
                text(
                    """
                    SELECT conname, pg_get_constraintdef(oid) AS definition
                    FROM pg_constraint
                    WHERE conrelid IN (
                        'dataset_versions'::regclass,
                        'dataset_version_cases'::regclass,
                        'evaluation_cases'::regclass,
                        'evaluators'::regclass,
                        'evaluator_versions'::regclass,
                        'quality_gate_policies'::regclass,
                        'quality_gate_results'::regclass,
                        'baseline_comparisons'::regclass,
                        'baseline_comparison_cases'::regclass
                    )
                      AND contype = 'c'
                    """
                )
            ).all()
        )
        assert any("status" in c and "DRAFT" in c and "DEPRECATED" in c for _, c in check_constraints)
        assert any("severity" in c and "CRITICAL" in c for _, c in check_constraints)
        assert any("version >= 1" in c for _, c in check_constraints)
        assert any("case_count >= 1" in c for _, c in check_constraints)
        assert any(
            "evaluator_type" in c and "CONTAINS" in c and "NOT_CONTAINS" in c and "REGEX" in c
            for _, c in check_constraints
        )
        assert any(
            "evaluator_type_snapshot" in c and "CONTAINS" in c and "NOT_CONTAINS" in c and "REGEX" in c
            for _, c in check_constraints
        )
        minimum_pass_rate_constraints = [
            c for _, c in check_constraints if _.startswith("ck_quality_gate_policies_minimum_pass_rate")
        ]
        assert len(minimum_pass_rate_constraints) == 1
        minimum_pass_rate_constraint = minimum_pass_rate_constraints[0]
        assert "minimum_pass_rate" in minimum_pass_rate_constraint
        assert ">=" in minimum_pass_rate_constraint
        assert "<=" in minimum_pass_rate_constraint
        assert "0" in minimum_pass_rate_constraint
        assert "1" in minimum_pass_rate_constraint
        assert any("passed_case_count" in c and "total_case_count" in c for _, c in check_constraints)
        assert any("pass_rate_delta" in c and ">=" in c and "<=" in c for _, c in check_constraints)
        assert any("improved_case_count" in c and "total_case_count" in c for _, c in check_constraints)
        assert any("change_status" in c and "IMPROVED" in c and "REGRESSED" in c for _, c in check_constraints)

        fk_deltypes = connection.execute(
            text(
                """
                SELECT confrelid::regclass::text, confdeltype
                FROM pg_constraint
                WHERE conrelid = 'datasets'::regclass AND confrelid = 'projects'::regclass
                UNION ALL
                SELECT confrelid::regclass::text, confdeltype
                FROM pg_constraint
                WHERE conrelid = 'evaluation_cases'::regclass AND confrelid = 'datasets'::regclass
                UNION ALL
                SELECT confrelid::regclass::text, confdeltype
                FROM pg_constraint
                WHERE conrelid = 'dataset_versions'::regclass AND confrelid = 'datasets'::regclass
                UNION ALL
                SELECT confrelid::regclass::text, confdeltype
                FROM pg_constraint
                WHERE conrelid = 'dataset_version_cases'::regclass
                  AND confrelid IN ('dataset_versions'::regclass, 'evaluation_cases'::regclass)
                UNION ALL
                SELECT confrelid::regclass::text, confdeltype
                FROM pg_constraint
                WHERE conrelid = 'evaluators'::regclass
                  AND confrelid = 'projects'::regclass
                UNION ALL
                SELECT confrelid::regclass::text, confdeltype
                FROM pg_constraint
                WHERE conrelid = 'evaluator_versions'::regclass
                  AND confrelid = 'evaluators'::regclass
                UNION ALL
                SELECT confrelid::regclass::text, confdeltype
                FROM pg_constraint
                WHERE conrelid = 'quality_gate_policies'::regclass
                  AND confrelid = 'projects'::regclass
                UNION ALL
                SELECT confrelid::regclass::text, confdeltype
                FROM pg_constraint
                WHERE conrelid = 'quality_gate_results'::regclass
                  AND confrelid IN ('quality_gate_policies'::regclass, 'experiments'::regclass)
                UNION ALL
                SELECT confrelid::regclass::text, confdeltype
                FROM pg_constraint
                WHERE conrelid = 'baseline_comparisons'::regclass
                  AND confrelid IN ('projects'::regclass, 'experiments'::regclass)
                UNION ALL
                SELECT confrelid::regclass::text, confdeltype
                FROM pg_constraint
                WHERE conrelid = 'baseline_comparison_cases'::regclass
                  AND confrelid IN ('baseline_comparisons'::regclass, 'dataset_version_cases'::regclass)
                """
            )
        ).all()
        assert fk_deltypes
        assert all(del_type == "r" for _, del_type in fk_deltypes)


def test_postgresql_api_flow_dataset_version():
    url = _get_postgres_url()
    if not url or not url.startswith("postgresql"):
        pytest.skip("TEST_DATABASE_URL is not set for PostgreSQL integration test.")
    _ensure_test_database_name(url)

    engine = create_async_engine(url, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    async def _run_flow() -> None:
        app.dependency_overrides[get_db_session] = _get_db
        try:
            with TestClient(app) as test_client:
                project = test_client.post(
                    "/api/v1/projects",
                    json={"slug": f"pg-flow-{uuid4()}", "name": "PG Flow", "description": "integration"},
                ).json()["data"]

                dataset = test_client.post(
                    f"/api/v1/projects/{project['id']}/datasets",
                    json={"name": "dataset", "description": "pg"},
                ).json()["data"]

                case = test_client.post(
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

                test_client.post(f"/api/v1/evaluation-cases/{case['id']}/approve")

                snapshot = test_client.post(f"/api/v1/datasets/{dataset['id']}/versions")
                assert snapshot.status_code == 201
                snapshot_id = snapshot.json()["data"]["id"]
                assert snapshot.json()["data"]["version"] == 1

                list_response = test_client.get(f"/api/v1/datasets/{dataset['id']}/versions")
                assert list_response.status_code == 200
                assert list_response.json()["data"][0]["id"] == snapshot_id

                detail_response = test_client.get(f"/api/v1/datasets/{dataset['id']}/versions/1")
                assert detail_response.status_code == 200
                assert detail_response.json()["data"]["id"] == snapshot_id
                assert len(detail_response.json()["data"]["cases"]) == 1
        finally:
            app.dependency_overrides.pop(get_db_session, None)

    try:
        asyncio.run(_run_flow())
    finally:
        asyncio.run(engine.dispose())


def test_postgresql_dataset_version_concurrency_for_duplicate_snapshot():
    url = _get_postgres_url()
    if not url or not url.startswith("postgresql"):
        pytest.skip("TEST_DATABASE_URL is not set for PostgreSQL integration test.")
    _ensure_test_database_name(url)

    engine = create_async_engine(url, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _run_test() -> None:
        dataset_id = None

        async with session_factory() as setup_session:
            project_service = ProjectService(setup_session)
            dataset_service = DatasetService(setup_session)
            case_service = EvaluationCaseService(setup_session)

            project = await project_service.create_project(
                _payload(slug=f"concur-{uuid4()}", name="Concur", description="x")
            )
            dataset = await dataset_service.create_dataset(project.id, _payload(name="concurrent-ds", description="x"))
            base = await case_service.create_case(
                dataset.id,
                _payload(
                    case_key="base",
                    question="base",
                    expected_summary="x",
                    evidence=[],
                    required_elements=[],
                    forbidden_elements=[],
                    tags=[],
                    severity=CaseSeverity.MEDIUM,
                    required_for_release=False,
                ),
            )
            await case_service.approve_case(base.id)
            dataset_id = dataset.id

        async def _worker() -> tuple[int | None, str | None]:
            assert dataset_id is not None
            async with session_factory() as session:
                version_service = DatasetVersionService(session)
                try:
                    version = await version_service.create_version(dataset_id)
                    return version.version, None
                except ErrorCodeError as exc:
                    return None, exc.code
                except Exception:
                    return None, "UNEXPECTED_ERROR"

        results = await asyncio.gather(*[_worker() for _ in range(5)], return_exceptions=True)
        versions: list[int] = []
        duplicate_errors: list[str] = []
        unexpected_errors: list[str] = []

        for item in results:
            if isinstance(item, tuple):
                version, error_code = item
                if error_code is None and version is not None:
                    versions.append(version)
                elif error_code == "DUPLICATE_DATASET_VERSION":
                    duplicate_errors.append(error_code)
                elif error_code is not None:
                    unexpected_errors.append(error_code)
            else:
                unexpected_errors.append("GATHER_EXCEPTION")

        assert len(versions) == 1
        assert versions[0] == 1
        assert len(duplicate_errors) == 4
        assert len(unexpected_errors) == 0

        async with session_factory() as verify_session:
            count_result = await verify_session.execute(
                text("SELECT COUNT(*) AS cnt FROM dataset_versions WHERE dataset_id = :dataset_id"),
                {"dataset_id": str(dataset_id)},
            )
            count = int(count_result.scalar_one())
        assert count == 1

    try:
        asyncio.run(_run_test())
    finally:
        asyncio.run(engine.dispose())


def test_postgresql_dataset_version_sequential_increase():
    url = _get_postgres_url()
    if not url or not url.startswith("postgresql"):
        pytest.skip("TEST_DATABASE_URL is not set for PostgreSQL integration test.")
    _ensure_test_database_name(url)

    engine = create_async_engine(url, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _run_test() -> None:
        async with session_factory() as setup_session:
            project_service = ProjectService(setup_session)
            dataset_service = DatasetService(setup_session)
            case_service = EvaluationCaseService(setup_session)
            version_service = DatasetVersionService(setup_session)

            project = await project_service.create_project(_payload(slug=f"seq-{uuid4()}", name="Seq", description="x"))
            dataset = await dataset_service.create_dataset(project.id, _payload(name="sequential-ds", description="x"))

            base = await case_service.create_case(
                dataset.id,
                _payload(
                    case_key="base",
                    question="base",
                    expected_summary="x",
                    evidence=[],
                    required_elements=[],
                    forbidden_elements=[],
                    tags=[],
                    severity=CaseSeverity.MEDIUM,
                    required_for_release=False,
                ),
            )
            await case_service.approve_case(base.id)

            version1 = await version_service.create_version(dataset.id)
            assert version1.version == 1

            case_2 = await case_service.create_case(
                dataset.id,
                _payload(
                    case_key="case-2",
                    question="q2",
                    expected_summary="s2",
                    evidence=[],
                    required_elements=[],
                    forbidden_elements=[],
                    tags=[],
                    severity=CaseSeverity.MEDIUM,
                    required_for_release=False,
                ),
            )
            await case_service.approve_case(case_2.id)
            version2 = await version_service.create_version(dataset.id)
            assert version2.version == 2

            case_3 = await case_service.create_case(
                dataset.id,
                _payload(
                    case_key="case-3",
                    question="q3",
                    expected_summary="s3",
                    evidence=[],
                    required_elements=[],
                    forbidden_elements=[],
                    tags=[],
                    severity=CaseSeverity.MEDIUM,
                    required_for_release=False,
                ),
            )
            await case_service.approve_case(case_3.id)
            version3 = await version_service.create_version(dataset.id)
            assert version3.version == 3

    try:
        asyncio.run(_run_test())
    finally:
        asyncio.run(engine.dispose())


def test_postgresql_api_flow_evaluator_version():
    url = _get_postgres_url()
    if not url or not url.startswith("postgresql"):
        pytest.skip("TEST_DATABASE_URL is not set for PostgreSQL integration test.")
    _ensure_test_database_name(url)

    engine = create_async_engine(url, future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    async def _run_flow() -> None:
        app.dependency_overrides[get_db_session] = _get_db
        try:
            with TestClient(app) as test_client:
                project = test_client.post(
                    "/api/v1/projects",
                    json={"slug": f"pg-eval-{uuid4()}", "name": "PG Eval", "description": "integration"},
                ).json()["data"]

                evaluator = test_client.post(
                    f"/api/v1/projects/{project['id']}/evaluators",
                    json={
                        "name": "contains-eval",
                        "evaluator_type": "CONTAINS",
                        "config": {"expected": "7", "case_sensitive": False},
                    },
                ).json()["data"]

                version_1 = test_client.post(f"/api/v1/evaluators/{evaluator['id']}/versions")
                assert version_1.status_code == 201
                assert version_1.json()["data"]["version"] == 1

                same = test_client.post(f"/api/v1/evaluators/{evaluator['id']}/versions")
                assert same.status_code == 409
                assert same.json()["error"]["code"] == "DUPLICATE_EVALUATOR_VERSION"

                updated = test_client.patch(
                    f"/api/v1/evaluators/{evaluator['id']}",
                    json={"config": {"case_sensitive": False, "expected": "8"}},
                )
                assert updated.status_code == 200

                version_2 = test_client.post(f"/api/v1/evaluators/{evaluator['id']}/versions")
                assert version_2.status_code == 201
                assert version_2.json()["data"]["version"] == 2

                detail = test_client.get(f"/api/v1/evaluators/{evaluator['id']}/versions/2")
                assert detail.status_code == 200
                assert detail.json()["data"]["version"] == 2
                assert detail.json()["data"]["evaluator_type_snapshot"] == "CONTAINS"
        finally:
            app.dependency_overrides.pop(get_db_session, None)

    try:
        asyncio.run(_run_flow())
    finally:
        asyncio.run(engine.dispose())


def test_postgresql_api_flow_experiment():
    url = _get_postgres_url()
    if not url or not url.startswith("postgresql"):
        pytest.skip("TEST_DATABASE_URL is not set for PostgreSQL integration test.")
    _ensure_test_database_name(url)

    engine = create_async_engine(
        url,
        future=True,
        poolclass=NullPool,
    )
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    async def _run_flow() -> None:
        app.dependency_overrides[get_db_session] = _get_db
        try:
            with TestClient(app) as test_client:
                project = test_client.post(
                    "/api/v1/projects",
                    json={"slug": f"pg-exp-{uuid4()}", "name": "PG Exp", "description": "integration"},
                ).json()["data"]

                dataset = test_client.post(
                    f"/api/v1/projects/{project['id']}/datasets",
                    json={"name": "dataset", "description": "pg"},
                ).json()["data"]

                created_case = test_client.post(
                    f"/api/v1/datasets/{dataset['id']}/evaluation-cases",
                    json={
                        "case_key": "case-1",
                        "question": "7일 이내 안내문",
                        "expected_summary": "응답해야 함",
                        "evidence": [],
                        "required_elements": [],
                        "forbidden_elements": [],
                        "tags": [],
                        "severity": "MEDIUM",
                        "required_for_release": False,
                    },
                ).json()["data"]
                approve = test_client.post(f"/api/v1/evaluation-cases/{created_case['id']}/approve")
                assert approve.status_code == 200

                snapshot = test_client.post(f"/api/v1/datasets/{dataset['id']}/versions")
                assert snapshot.status_code == 201
                dataset_version_id = snapshot.json()["data"]["id"]

                target = test_client.post(
                    f"/api/v1/projects/{project['id']}/targets",
                    json={
                        "name": "mock-target",
                        "target_type": "MOCK",
                        "config": {"fixed_response": {"text": "7일"}},
                    },
                ).json()["data"]
                target_version = test_client.post(f"/api/v1/targets/{target['id']}/versions")
                assert target_version.status_code == 201
                target_version_id = target_version.json()["data"]["id"]

                evaluator = test_client.post(
                    f"/api/v1/projects/{project['id']}/evaluators",
                    json={
                        "name": "contains",
                        "evaluator_type": "CONTAINS",
                        "config": {"expected": "7일", "case_sensitive": False},
                    },
                ).json()["data"]
                evaluator_version = test_client.post(f"/api/v1/evaluators/{evaluator['id']}/versions")
                assert evaluator_version.status_code == 201
                evaluator_version_id = evaluator_version.json()["data"]["id"]

                experiment = test_client.post(
                    "/api/v1/experiments",
                    json={
                        "dataset_version_id": dataset_version_id,
                        "target_version_id": target_version_id,
                        "evaluator_version_id": evaluator_version_id,
                    },
                )
                assert experiment.status_code == 201
                experiment_id = experiment.json()["data"]["id"]

                run = test_client.post(f"/api/v1/experiments/{experiment_id}/run")
                assert run.status_code == 200
                assert run.json()["data"]["status"] == "COMPLETED"

                results = test_client.get(f"/api/v1/experiments/{experiment_id}/results")
                assert results.status_code == 200
                payload = results.json()
                assert payload["meta"]["pagination"]["total"] == 1
                assert len(payload["data"]) == 1
                assert payload["data"][0]["status"] == "PASS"

                current_experiment = test_client.post(
                    "/api/v1/experiments",
                    json={
                        "dataset_version_id": dataset_version_id,
                        "target_version_id": target_version_id,
                        "evaluator_version_id": evaluator_version_id,
                    },
                )
                assert current_experiment.status_code == 201
                current_experiment_id = current_experiment.json()["data"]["id"]
                current_run = test_client.post(f"/api/v1/experiments/{current_experiment_id}/run")
                assert current_run.status_code == 200
                assert current_run.json()["data"]["status"] == "COMPLETED"

                compare_payload = BaselineComparisonCreateRequest(
                    baseline_experiment_id=experiment_id,
                    current_experiment_id=current_experiment_id,
                )

                async def _compare_once():
                    async with session_factory() as comparison_session:
                        try:
                            return await BaselineComparisonService(comparison_session).create_comparison(compare_payload)
                        except ErrorCodeError as exc:
                            return exc

                comparison_results = await asyncio.gather(_compare_once(), _compare_once())
                successful = [item for item in comparison_results if not isinstance(item, ErrorCodeError)]
                duplicates = [item for item in comparison_results if isinstance(item, ErrorCodeError)]
                assert len(successful) == 1
                assert len(duplicates) == 1
                assert duplicates[0].code == "BASELINE_COMPARISON_ALREADY_EXISTS"

                comparison = test_client.get(f"/api/v1/baseline-comparisons/{successful[0].id}")
                assert comparison.status_code == 200
                assert comparison.json()["data"]["status"] == "UNCHANGED"
                comparison_cases = test_client.get(
                    f"/api/v1/baseline-comparisons/{successful[0].id}/cases"
                )
                assert comparison_cases.status_code == 200
                assert comparison_cases.json()["meta"]["pagination"]["total"] == 1

                policy = test_client.post(
                    f"/api/v1/projects/{project['id']}/quality-gate-policies",
                    json={"name": "release", "minimum_pass_rate": 1.0},
                )
                assert policy.status_code == 201
                policy_id = policy.json()["data"]["id"]

                gate = test_client.post(
                    f"/api/v1/quality-gate-policies/{policy_id}/evaluate",
                    json={"experiment_id": experiment_id},
                )
                assert gate.status_code == 200
                gate_payload = gate.json()["data"]
                assert gate_payload["status"] == "PASS"
                assert gate_payload["reason_codes"] == []
                gate_result = test_client.get(f"/api/v1/quality-gate-results/{gate_payload['id']}")
                assert gate_result.status_code == 200
                assert gate_result.json()["data"]["id"] == gate_payload["id"]

                rerun = test_client.post(f"/api/v1/experiments/{experiment_id}/run")
                assert rerun.status_code == 409
                assert rerun.json()["error"]["code"] == "INVALID_STATE_TRANSITION"
        finally:
            app.dependency_overrides.pop(get_db_session, None)

    try:
        asyncio.run(_run_flow())
    finally:
        asyncio.run(engine.dispose())
