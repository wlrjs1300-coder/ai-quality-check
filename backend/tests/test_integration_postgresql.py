from __future__ import annotations

from collections.abc import AsyncGenerator
import asyncio
import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.api.deps import get_db_session
from src.api.main import app


def _get_postgres_url() -> str | None:
    return os.environ.get("TEST_DATABASE_URL")


def _postgres_url_for_sync(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql+psycopg://")


def _ensure_test_database_name(url: str) -> None:
    # Safety gate: never run destructive migration operations on non-test databases.
    database_name = url.rsplit("/", 1)[-1].split("?")[0]
    assert (
        "test" in database_name.lower()
    ), f"Refusing PostgreSQL integration tests for database '{database_name}' because it does not contain 'test'."


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
        assert completed.returncode == 0, stderr


def _db_connection(url: str):
    return create_engine(_postgres_url_for_sync(url), future=True)


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
                  AND table_name = 'evaluation_cases'
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
                    WHERE conrelid IN ('projects'::regclass, 'datasets'::regclass, 'evaluation_cases'::regclass)
                      AND contype = 'u'
                    """
                )
            ).scalars().all()
        )
        assert "uq_projects_slug" in unique_constraints
        assert "uq_datasets_project_name" in unique_constraints
        assert "uq_evaluation_cases_dataset_case_key" in unique_constraints

        check_constraints = set(
            connection.execute(
                text(
                    """
                    SELECT conname, pg_get_constraintdef(oid) AS definition
                    FROM pg_constraint
                    WHERE conrelid = 'evaluation_cases'::regclass
                      AND contype = 'c'
                    """
                )
            ).all()
        )
        assert any("status" in c and "DRAFT" in c and "DEPRECATED" in c for _, c in check_constraints)
        assert any("severity" in c and "CRITICAL" in c for _, c in check_constraints)

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
                """
            )
        ).all()
        assert fk_deltypes
        assert all(del_type == "r" for _, del_type in fk_deltypes)


def test_postgresql_api_flow_dataset_and_case_mutations():
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
                slug = f"pg-flow-{uuid4()}"
                project = test_client.post(
                    "/api/v1/projects",
                    json={"slug": slug, "name": "PG Flow", "description": "integration"},
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

                approve = test_client.post(f"/api/v1/evaluation-cases/{case['id']}/approve")
                assert approve.status_code == 200
                assert approve.json()["data"]["status"] == "APPROVED"

                deprecate = test_client.post(f"/api/v1/evaluation-cases/{case['id']}/deprecate")
                assert deprecate.status_code == 200
                assert deprecate.json()["data"]["status"] == "DEPRECATED"
        finally:
            app.dependency_overrides.pop(get_db_session, None)

    try:
        asyncio.run(_run_flow())
    finally:
        asyncio.run(engine.dispose())
