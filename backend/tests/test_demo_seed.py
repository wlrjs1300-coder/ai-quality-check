from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.application.errors import ErrorCodeError
from src.application.services.demo_seed_service import (
    CASE_SPECS,
    DEMO_NAMESPACE,
    DemoSeedService,
    demo_uuid,
)
from src.domain.models import (
    BaselineComparison,
    BaselineComparisonCase,
    Dataset,
    DatasetVersionCase,
    EvaluationCase,
    EvaluationResult,
    Experiment,
    Project,
    QualityGateResult,
    TargetVersion,
)
from src.scripts.seed_demo import _database_name_is_allowed


def _seed() -> object:
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _run():
        try:
            async with session_factory() as session:
                return await DemoSeedService(session).seed()
        finally:
            await engine.dispose()

    return asyncio.run(_run())


def _query_graph():
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _run():
        try:
            async with session_factory() as session:
                project = await session.get(Project, demo_uuid("project:evalops-demo"))
                cases = list((await session.execute(select(EvaluationCase).order_by(EvaluationCase.case_key))).scalars())
                snapshots = list(
                    (await session.execute(select(DatasetVersionCase).order_by(DatasetVersionCase.case_key))).scalars()
                )
                experiments = list(
                    (await session.execute(select(Experiment).order_by(Experiment.created_at))).scalars()
                )
                results = list((await session.execute(select(EvaluationResult))).scalars())
                gates = list((await session.execute(select(QualityGateResult).order_by(QualityGateResult.created_at))).scalars())
                comparisons = list(
                    (await session.execute(select(BaselineComparison).order_by(BaselineComparison.created_at))).scalars()
                )
                comparison_case_count = int(
                    await session.scalar(select(func.count()).select_from(BaselineComparisonCase)) or 0
                )
                target_version_count = int(
                    await session.scalar(select(func.count()).select_from(TargetVersion)) or 0
                )
                return (
                    project,
                    cases,
                    snapshots,
                    experiments,
                    results,
                    gates,
                    comparisons,
                    comparison_case_count,
                    target_version_count,
                )
        finally:
            await engine.dispose()

    return asyncio.run(_run())


def test_demo_seed_creates_deterministic_complete_graph(client):
    first = _seed()
    assert first.status == "created"
    assert first.project_id == demo_uuid("project:evalops-demo")
    assert demo_uuid("project:evalops-demo") == demo_uuid("project:evalops-demo")
    assert isinstance(DEMO_NAMESPACE, UUID)

    (
        project,
        cases,
        snapshots,
        experiments,
        results,
        gates,
        comparisons,
        comparison_case_count,
        target_version_count,
    ) = _query_graph()
    assert project is not None
    assert project.slug == "evalops-demo"
    assert project.created_at.year == 2026
    assert len(cases) == 5
    assert all(item.status == "APPROVED" for item in cases)
    assert len(snapshots) == 5
    assert {item.case_key: item.required_for_release for item in snapshots} == {
        spec["key"]: spec["required"] for spec in CASE_SPECS
    }
    assert target_version_count == 4
    assert len(experiments) == 4
    assert all(item.status == "COMPLETED" for item in experiments)
    assert [(item.pass_count, item.fail_count) for item in experiments] == [(3, 2), (4, 1), (4, 1), (2, 3)]
    assert len(results) == 20
    assert all(item.total_cases == 5 for item in experiments)
    assert [item.status for item in gates] == ["BLOCK", "PASS", "PASS", "BLOCK"]
    assert [str(item.pass_rate) for item in gates] == ["0.6000", "0.8000", "0.8000", "0.4000"]
    assert [item.status for item in comparisons] == ["IMPROVED", "UNCHANGED", "REGRESSED"]
    assert comparison_case_count == 15


def test_demo_seed_second_run_is_noop_and_dashboard_is_ready_for_demo(client):
    first = _seed()
    second = _seed()
    assert first.status == "created"
    assert second.status == "already_seeded"
    assert first.project_id == second.project_id

    dashboard = client.get(f"/api/v1/projects/{first.project_id}/dashboard-overview")
    assert dashboard.status_code == 200
    data = dashboard.json()["data"]
    assert data["readiness"]["status"] == "NOT_READY"
    assert data["latest_quality_gate_result"]["status"] == "BLOCK"
    assert data["latest_baseline_comparison"]["status"] == "REGRESSED"
    assert data["trend"]["direction"] == "DECLINING"
    assert data["kpis"]["experiment_count"] == 4
    assert data["warning_codes"] == [
        "GATE_BLOCK_HISTORY_PRESENT",
        "REGRESSION_HISTORY_PRESENT",
        "PASS_RATE_DECLINING",
    ]
    history = client.get(f"/api/v1/projects/{first.project_id}/experiment-history?sort=created_at_asc")
    assert history.status_code == 200
    assert [item["pass_rate"] for item in history.json()["data"]] == ["0.6", "0.8", "0.8", "0.4"]


def test_demo_seed_second_run_preserves_non_seed_case_in_demo_dataset(client):
    first = _seed()
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    user_case_id = uuid4()

    async def _add_and_verify_user_case() -> tuple[str, str, int, int, int, bool]:
        try:
            async with session_factory() as session:
                session.add(
                    EvaluationCase(
                        id=user_case_id,
                        dataset_id=demo_uuid("dataset:release-policy"),
                        case_key="user-created-case",
                        question="User-created question",
                        expected_summary="User-created summary",
                        evidence=[],
                        required_elements=[],
                        forbidden_elements=[],
                        tags=[],
                        severity="LOW",
                        required_for_release=False,
                        status="DRAFT",
                    )
                )
                await session.commit()
            async with session_factory() as session:
                second = await DemoSeedService(session).seed()
                third = await DemoSeedService(session).seed()
                total_case_count = int(
                    await session.scalar(
                        select(func.count())
                        .select_from(EvaluationCase)
                        .where(EvaluationCase.dataset_id == demo_uuid("dataset:release-policy"))
                    )
                    or 0
                )
                seed_case_count = int(
                    await session.scalar(
                        select(func.count())
                        .select_from(EvaluationCase)
                        .where(
                            EvaluationCase.dataset_id == demo_uuid("dataset:release-policy"),
                            EvaluationCase.id.in_(
                                {demo_uuid(f"case:{spec['key']}") for spec in CASE_SPECS}
                            ),
                        )
                    )
                    or 0
                )
                snapshot_count = int(
                    await session.scalar(
                        select(func.count())
                        .select_from(DatasetVersionCase)
                        .where(
                            DatasetVersionCase.dataset_version_id
                            == demo_uuid("dataset-version:release-policy:1")
                        )
                    )
                    or 0
                )
                user_case = await session.get(EvaluationCase, user_case_id)
                user_case_unchanged = user_case is not None and (
                    user_case.case_key,
                    user_case.status,
                    user_case.question,
                    user_case.expected_summary,
                ) == (
                    "user-created-case",
                    "DRAFT",
                    "User-created question",
                    "User-created summary",
                )
                return (
                    second.status,
                    third.status,
                    total_case_count,
                    seed_case_count,
                    snapshot_count,
                    user_case_unchanged,
                )
        finally:
            await engine.dispose()

    assert first.status == "created"
    assert asyncio.run(_add_and_verify_user_case()) == (
        "already_seeded",
        "already_seeded",
        6,
        5,
        5,
        True,
    )


def test_demo_seed_conflict_rolls_back_without_mutating_existing_data(client):
    project_id = demo_uuid("project:evalops-demo")
    created = client.post(
        "/api/v1/projects",
        json={"slug": "evalops-demo", "name": "Conflicting Project", "description": None},
    )
    assert created.status_code == 201
    assert created.json()["data"]["id"] != str(project_id)

    with pytest.raises(ErrorCodeError) as raised:
        _seed()
    assert raised.value.code == "DEMO_SEED_CONFLICT"
    assert client.get("/api/v1/projects").json()["meta"]["pagination"]["total"] == 1
    assert client.get(f"/api/v1/projects/{project_id}").status_code == 404


def test_demo_seed_partial_graph_is_rejected(client):
    first = _seed()
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _change() -> None:
        try:
            async with session_factory() as session:
                dataset = await session.get(Dataset, demo_uuid("dataset:release-policy"))
                assert dataset is not None
                dataset.name = "Unexpected Name"
                await session.commit()
        finally:
            await engine.dispose()

    asyncio.run(_change())
    with pytest.raises(ErrorCodeError) as raised:
        _seed()
    assert raised.value.code == "DEMO_SEED_CONFLICT"
    assert first.project_id == demo_uuid("project:evalops-demo")


def test_demo_seed_mid_creation_failure_rolls_back_all_rows(client):
    engine = create_async_engine(os.environ["DATABASE_URL"], future=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _fail_and_check() -> int:
        try:
            async with session_factory() as session:
                service = DemoSeedService(session)
                create_graph = service._create_graph

                async def _failing_graph() -> None:
                    await create_graph()
                    raise RuntimeError("synthetic seed failure")

                service._create_graph = _failing_graph  # type: ignore[method-assign]
                with pytest.raises(RuntimeError, match="synthetic seed failure"):
                    await service.seed()
            async with session_factory() as verify_session:
                return int(await verify_session.scalar(select(func.count()).select_from(Project)) or 0)
        finally:
            await engine.dispose()

    assert asyncio.run(_fail_and_check()) == 0


def test_demo_seed_cli_database_guard():
    assert _database_name_is_allowed("postgresql+asyncpg://user:pass@localhost/evalops_local")
    assert _database_name_is_allowed("postgresql+asyncpg://user:pass@localhost/evalops_test")
    assert _database_name_is_allowed("sqlite+aiosqlite:///tmp/evalops_test.db")
    assert not _database_name_is_allowed("postgresql+asyncpg://user:pass@localhost/postgres")
    assert not _database_name_is_allowed("postgresql+asyncpg://user:pass@localhost/production")
    assert not _database_name_is_allowed("sqlite+aiosqlite:///tmp/evalops_dev.db")


def test_demo_seed_cli_smoke_reports_already_seeded(client):
    _seed()
    completed = subprocess.run(
        [sys.executable, "-m", "src.scripts.seed_demo"],
        capture_output=True,
        text=True,
        timeout=30,
        env=os.environ.copy(),
    )
    assert completed.returncode == 0
    assert "Demo seed already exists and matches the expected definition." in completed.stdout
    assert "status: already_seeded" in completed.stdout
    assert "DATABASE_URL" not in completed.stdout
