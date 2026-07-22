from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid5

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.domain.models import (
    BaselineComparison,
    BaselineComparisonCase,
    Dataset,
    DatasetVersion,
    DatasetVersionCase,
    EvaluationCase,
    EvaluationResult,
    Evaluator,
    EvaluatorVersion,
    Experiment,
    Project,
    QualityGatePolicy,
    QualityGateResult,
    Target,
    TargetVersion,
)

DEMO_NAMESPACE = UUID("2f824f8d-7430-4df3-b7aa-dce271226e61")
DEMO_PROJECT_SLUG = "evalops-demo"
DEMO_PROJECT_NAME = "EvalOps Demo Project"
DEMO_PROJECT_DESCRIPTION = (
    "Synthetic demonstration project for deterministic AI quality evaluation workflows."
)


def demo_uuid(name: str) -> UUID:
    return uuid5(DEMO_NAMESPACE, name)


def _time(day: int, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(2026, 7, day, hour, minute, tzinfo=timezone.utc)


def _hash(value: object) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _comparable_time(value: datetime) -> datetime:
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


CASE_SPECS = (
    {
        "key": "refund-window",
        "question": "What is the synthetic refund request window?",
        "summary": "State the fictional seven-day request window.",
        "severity": "CRITICAL",
        "required": True,
        "tags": ["refund", "policy"],
    },
    {
        "key": "cancellation-condition",
        "question": "Which fictional condition permits cancellation?",
        "summary": "Explain the synthetic unused-service condition.",
        "severity": "HIGH",
        "required": True,
        "tags": ["cancellation", "condition"],
    },
    {
        "key": "support-channel",
        "question": "Where is synthetic customer support available?",
        "summary": "Mention the demonstration support portal.",
        "severity": "MEDIUM",
        "required": False,
        "tags": ["support"],
    },
    {
        "key": "privacy-notice",
        "question": "How should synthetic personal information be handled?",
        "summary": "State that unnecessary personal information must not be included.",
        "severity": "CRITICAL",
        "required": False,
        "tags": ["privacy", "safety"],
    },
    {
        "key": "prohibited-guarantee",
        "question": "May the synthetic service guarantee every outcome?",
        "summary": "Avoid unconditional guarantees.",
        "severity": "HIGH",
        "required": False,
        "tags": ["prohibited-expression"],
    },
)

SCENARIOS = (
    ("baseline", _time(10, 9), ("PASS", "FAIL", "PASS", "FAIL", "PASS")),
    ("improved", _time(11, 9), ("PASS", "PASS", "PASS", "FAIL", "PASS")),
    ("stable", _time(12, 9), ("PASS", "PASS", "PASS", "FAIL", "PASS")),
    ("regressed", _time(13, 9), ("FAIL", "PASS", "FAIL", "FAIL", "PASS")),
)


@dataclass(frozen=True)
class DemoSeedResult:
    status: str
    project_id: UUID
    dataset_version_id: UUID
    experiment_count: int
    quality_gate_result_count: int
    baseline_comparison_count: int
    latest_readiness: str


class DemoSeedService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _conflict(entity: str, expected: object, actual: object) -> ErrorCodeError:
        return ErrorCodeError(
            "DEMO_SEED_CONFLICT",
            f"Demo seed conflict for {entity}: expected {expected!r}, actual {actual!r}.",
            409,
        )

    @staticmethod
    def _result(status: str) -> DemoSeedResult:
        return DemoSeedResult(
            status=status,
            project_id=demo_uuid("project:evalops-demo"),
            dataset_version_id=demo_uuid("dataset-version:release-policy:1"),
            experiment_count=4,
            quality_gate_result_count=4,
            baseline_comparison_count=3,
            latest_readiness="NOT_READY",
        )

    async def seed(self) -> DemoSeedResult:
        async with self.db.begin():
            project_id = demo_uuid("project:evalops-demo")
            project = await self.db.get(Project, project_id)
            slug_owner = await self.db.scalar(select(Project).where(Project.slug == DEMO_PROJECT_SLUG))
            if project is not None or slug_owner is not None:
                if project is None or slug_owner is None or slug_owner.id != project_id:
                    raise self._conflict("project", project_id, getattr(slug_owner, "id", None))
                await self._validate_existing(project)
                return self._result("already_seeded")

            await self._ensure_fixed_ids_unused()
            await self._create_graph()
            return self._result("created")

    async def _ensure_fixed_ids_unused(self) -> None:
        checks: list[tuple[type, UUID, str]] = [
            (Dataset, demo_uuid("dataset:release-policy"), "dataset"),
            (DatasetVersion, demo_uuid("dataset-version:release-policy:1"), "dataset_version"),
            (Target, demo_uuid("target:demo-target"), "target"),
            (Evaluator, demo_uuid("evaluator:demo-evaluator"), "evaluator"),
            (EvaluatorVersion, demo_uuid("evaluator-version:demo-evaluator:1"), "evaluator_version"),
            (QualityGatePolicy, demo_uuid("quality-gate-policy:demo-release-gate"), "quality_gate_policy"),
        ]
        checks.extend(
            (EvaluationCase, demo_uuid(f"case:{spec['key']}"), f"case:{spec['key']}")
            for spec in CASE_SPECS
        )
        checks.extend(
            (DatasetVersionCase, demo_uuid(f"dataset-version-case:{spec['key']}"), f"snapshot:{spec['key']}")
            for spec in CASE_SPECS
        )
        for name, _, _ in SCENARIOS:
            checks.extend(
                (
                    (TargetVersion, demo_uuid(f"target-version:{name}"), f"target_version:{name}"),
                    (Experiment, demo_uuid(f"experiment:{name}"), f"experiment:{name}"),
                    (QualityGateResult, demo_uuid(f"quality-gate-result:{name}"), f"gate:{name}"),
                )
            )
            checks.extend(
                (
                    EvaluationResult,
                    demo_uuid(f"evaluation-result:{name}:{spec['key']}"),
                    f"result:{name}:{spec['key']}",
                )
                for spec in CASE_SPECS
            )
        for baseline, current in (("baseline", "improved"), ("improved", "stable"), ("stable", "regressed")):
            checks.append(
                (
                    BaselineComparison,
                    demo_uuid(f"comparison:{baseline}:{current}"),
                    f"comparison:{baseline}:{current}",
                )
            )
            checks.extend(
                (
                    BaselineComparisonCase,
                    demo_uuid(f"comparison-case:{baseline}:{current}:{spec['key']}"),
                    f"comparison-case:{baseline}:{current}:{spec['key']}",
                )
                for spec in CASE_SPECS
            )
        for model, identifier, label in checks:
            if await self.db.get(model, identifier) is not None:
                raise self._conflict(label, "unused fixed UUID", identifier)

    async def _create_graph(self) -> None:
        project_id = demo_uuid("project:evalops-demo")
        dataset_id = demo_uuid("dataset:release-policy")
        dataset_version_id = demo_uuid("dataset-version:release-policy:1")
        target_id = demo_uuid("target:demo-target")
        evaluator_id = demo_uuid("evaluator:demo-evaluator")
        evaluator_version_id = demo_uuid("evaluator-version:demo-evaluator:1")
        policy_id = demo_uuid("quality-gate-policy:demo-release-gate")

        self.db.add(
            Project(
                id=project_id,
                slug=DEMO_PROJECT_SLUG,
                name=DEMO_PROJECT_NAME,
                description=DEMO_PROJECT_DESCRIPTION,
                is_active=True,
                created_at=_time(1),
                updated_at=_time(1),
            )
        )
        await self.db.flush()

        self.db.add(
            Dataset(
                id=dataset_id,
                project_id=project_id,
                name="Synthetic Release Policy Evaluation",
                description="Five synthetic cases for a deterministic release-quality demonstration.",
                is_active=True,
                created_at=_time(1, 1),
                updated_at=_time(1, 1),
            )
        )
        self.db.add(
            Target(
                id=target_id,
                project_id=project_id,
                name="Demo Fixed Target",
                target_type="MOCK",
                config={"fixed_response": {"text": "Synthetic regressed response."}},
                is_active=True,
                created_at=_time(3),
                updated_at=_time(3),
            )
        )
        evaluator_config = {"expected": "synthetic", "case_sensitive": False}
        self.db.add(
            Evaluator(
                id=evaluator_id,
                project_id=project_id,
                name="Demo Contains Evaluator",
                evaluator_type="CONTAINS",
                config=evaluator_config,
                is_active=True,
                created_at=_time(4),
                updated_at=_time(4),
            )
        )
        self.db.add(
            QualityGatePolicy(
                id=policy_id,
                project_id=project_id,
                name="demo-release-gate",
                minimum_pass_rate=Decimal("0.8000"),
                block_on_error=True,
                block_on_required_case_failure=True,
                is_active=True,
                created_at=_time(5),
                updated_at=_time(5),
            )
        )
        await self.db.flush()

        for index, spec in enumerate(CASE_SPECS):
            created_at = _time(1, 2, index)
            self.db.add(
                EvaluationCase(
                    id=demo_uuid(f"case:{spec['key']}"),
                    dataset_id=dataset_id,
                    case_key=spec["key"],
                    question=spec["question"],
                    expected_summary=spec["summary"],
                    evidence=[{"source_id": "synthetic-policy", "content": "Demonstration-only policy evidence."}],
                    required_elements=[],
                    forbidden_elements=[],
                    tags=spec["tags"],
                    severity=spec["severity"],
                    required_for_release=spec["required"],
                    status="APPROVED",
                    created_at=created_at,
                    updated_at=created_at,
                )
            )

        self.db.add(
            EvaluatorVersion(
                id=evaluator_version_id,
                evaluator_id=evaluator_id,
                version=1,
                content_hash=_hash(
                    {"schema_version": 1, "evaluator_type": "CONTAINS", "config": evaluator_config}
                ),
                evaluator_type_snapshot="CONTAINS",
                config_snapshot=evaluator_config,
                created_at=_time(4, 1),
            )
        )
        snapshot_definition = [
            {
                "case_key": spec["key"],
                "question": spec["question"],
                "expected_summary": spec["summary"],
                "required_for_release": spec["required"],
                "severity": spec["severity"],
            }
            for spec in CASE_SPECS
        ]
        self.db.add(
            DatasetVersion(
                id=dataset_version_id,
                dataset_id=dataset_id,
                version=1,
                content_hash=_hash({"schema_version": 1, "cases": snapshot_definition}),
                case_count=5,
                created_at=_time(2),
            )
        )
        for version, (name, _, _) in enumerate(SCENARIOS, start=1):
            config = {"fixed_response": {"text": f"Synthetic {name} response."}}
            hash_input = {
                "schema_version": 1,
                "target_type": "MOCK",
                "config": config,
                "response_strategy": "FIXED",
                "latency_ms": 0,
                "failure_rate": 0.0,
            }
            self.db.add(
                TargetVersion(
                    id=demo_uuid(f"target-version:{name}"),
                    target_id=target_id,
                    version=version,
                    content_hash=_hash(hash_input),
                    config_snapshot=config,
                    response_strategy="FIXED",
                    latency_ms=0,
                    failure_rate=0.0,
                    created_at=_time(3, version),
                )
            )
        await self.db.flush()

        for spec in CASE_SPECS:
            self.db.add(
                DatasetVersionCase(
                    id=demo_uuid(f"dataset-version-case:{spec['key']}"),
                    dataset_version_id=dataset_version_id,
                    source_evaluation_case_id=demo_uuid(f"case:{spec['key']}"),
                    case_key=spec["key"],
                    question=spec["question"],
                    expected_summary=spec["summary"],
                    evidence=[{"source_id": "synthetic-policy", "content": "Demonstration-only policy evidence."}],
                    required_elements=[],
                    forbidden_elements=[],
                    tags=spec["tags"],
                    severity=spec["severity"],
                    required_for_release=spec["required"],
                    created_at=_time(2),
                )
            )
        await self.db.flush()

        experiments: list[Experiment] = []
        quality_gate_results: list[QualityGateResult] = []
        evaluation_results: list[EvaluationResult] = []

        for version, (name, created_at, statuses) in enumerate(SCENARIOS, start=1):
            experiment_id = demo_uuid(f"experiment:{name}")
            pass_count = statuses.count("PASS")
            fail_count = statuses.count("FAIL")
            experiments.append(
                Experiment(
                    id=experiment_id,
                    dataset_version_id=dataset_version_id,
                    target_version_id=demo_uuid(f"target-version:{name}"),
                    evaluator_version_id=evaluator_version_id,
                    status="COMPLETED",
                    total_cases=5,
                    pass_count=pass_count,
                    fail_count=fail_count,
                    error_count=0,
                    completed_at=created_at.replace(minute=30),
                    created_at=created_at,
                    updated_at=created_at.replace(minute=30),
                )
            )
            for spec, status in zip(CASE_SPECS, statuses, strict=True):
                evaluation_results.append(
                    EvaluationResult(
                        id=demo_uuid(f"evaluation-result:{name}:{spec['key']}"),
                        experiment_id=experiment_id,
                        dataset_version_case_id=demo_uuid(f"dataset-version-case:{spec['key']}"),
                        input_snapshot={"question": spec["question"]},
                        output_snapshot={"text": f"Synthetic {name} response."},
                        status=status,
                        reason_code=None if status == "PASS" else "DEMO_EXPECTATION_NOT_MET",
                        reason=None if status == "PASS" else "The synthetic response did not meet the demo expectation.",
                        created_at=created_at.replace(minute=30),
                    )
                )

            required_failures = sum(
                spec["required"] and status != "PASS"
                for spec, status in zip(CASE_SPECS, statuses, strict=True)
            )
            pass_rate = (Decimal(pass_count) / Decimal(5)).quantize(Decimal("0.0001"))
            reasons = []
            if pass_rate < Decimal("0.8000"):
                reasons.append("PASS_RATE_BELOW_THRESHOLD")
            if required_failures:
                reasons.append("REQUIRED_CASE_FAILURE_PRESENT")
            quality_gate_results.append(
                QualityGateResult(
                    id=demo_uuid(f"quality-gate-result:{name}"),
                    policy_id=policy_id,
                    experiment_id=experiment_id,
                    status="BLOCK" if reasons else "PASS",
                    pass_rate=pass_rate,
                    total_case_count=5,
                    passed_case_count=pass_count,
                    failed_case_count=fail_count,
                    error_case_count=0,
                    required_case_failure_count=required_failures,
                    reason_codes=reasons,
                    reason_summary="; ".join(reasons) if reasons else None,
                    created_at=created_at.replace(minute=35),
                )
            )

        self.db.add_all(experiments)
        self.db.add_all(quality_gate_results)
        await self.db.flush()

        self.db.add_all(evaluation_results)
        await self.db.flush()

        comparison_payloads: list[tuple[str, str, list[tuple[dict, str, str, str, str]], UUID]] = []
        for baseline, current in (("baseline", "improved"), ("improved", "stable"), ("stable", "regressed")):
            comparison_id, changes = self._add_comparison(project_id, baseline, current)
            comparison_payloads.append((baseline, current, changes, comparison_id))
        await self.db.flush()

        for baseline, current, changes, comparison_id in comparison_payloads:
            time_map = {name: created_at for name, created_at, _ in SCENARIOS}
            created_at = time_map[current].replace(minute=40)
            for spec, before, after, change, reason in changes:
                self.db.add(
                    BaselineComparisonCase(
                        id=demo_uuid(f"comparison-case:{baseline}:{current}:{spec['key']}"),
                        comparison_id=comparison_id,
                        dataset_version_case_id=demo_uuid(f"dataset-version-case:{spec['key']}"),
                        case_key=spec["key"],
                        baseline_status=before,
                        current_status=after,
                        change_status=change,
                        reason_code=reason,
                        created_at=created_at,
                    )
                )
        await self.db.flush()

    def _add_comparison(self, project_id: UUID, baseline: str, current: str) -> tuple[UUID, list[tuple[dict, str, str, str, str]]]:
        status_map = {name: statuses for name, _, statuses in SCENARIOS}
        time_map = {name: created_at for name, created_at, _ in SCENARIOS}
        baseline_statuses = status_map[baseline]
        current_statuses = status_map[current]
        changes = []
        counts = {"IMPROVED": 0, "UNCHANGED": 0, "REGRESSED": 0}
        ranks = {"FAIL": 0, "PASS": 1}
        for spec, before, after in zip(CASE_SPECS, baseline_statuses, current_statuses, strict=True):
            difference = ranks[after] - ranks[before]
            change = "IMPROVED" if difference > 0 else "REGRESSED" if difference < 0 else "UNCHANGED"
            counts[change] += 1
            reason = "FAIL_TO_PASS" if change == "IMPROVED" else "PASS_TO_FAIL" if change == "REGRESSED" else "STATUS_UNCHANGED"
            changes.append((spec, before, after, change, reason))
        overall = "REGRESSED" if counts["REGRESSED"] else "IMPROVED" if counts["IMPROVED"] else "UNCHANGED"
        reason_codes = {
            "REGRESSED": ["CASE_REGRESSION_PRESENT"],
            "IMPROVED": ["CASE_IMPROVEMENT_PRESENT"],
            "UNCHANGED": ["NO_CASE_CHANGE"],
        }[overall]
        comparison_id = demo_uuid(f"comparison:{baseline}:{current}")
        created_at = time_map[current].replace(minute=40)
        baseline_passed = baseline_statuses.count("PASS")
        current_passed = current_statuses.count("PASS")
        self.db.add(
            BaselineComparison(
                id=comparison_id,
                project_id=project_id,
                baseline_experiment_id=demo_uuid(f"experiment:{baseline}"),
                current_experiment_id=demo_uuid(f"experiment:{current}"),
                status=overall,
                total_case_count=5,
                improved_case_count=counts["IMPROVED"],
                unchanged_case_count=counts["UNCHANGED"],
                regressed_case_count=counts["REGRESSED"],
                baseline_passed_case_count=baseline_passed,
                current_passed_case_count=current_passed,
                pass_rate_delta=(Decimal(current_passed - baseline_passed) / Decimal(5)).quantize(
                    Decimal("0.0001")
                ),
                reason_codes=reason_codes,
                reason_summary=(
                    f"Improved: {counts['IMPROVED']}; unchanged: {counts['UNCHANGED']}; "
                    f"regressed: {counts['REGRESSED']}."
                ),
                created_at=created_at,
            )
        )
        return comparison_id, changes

    async def _validate_existing(self, project: Project) -> None:
        expected_project = (
            DEMO_PROJECT_SLUG,
            DEMO_PROJECT_NAME,
            DEMO_PROJECT_DESCRIPTION,
            True,
            _time(1),
        )
        actual_project = (
            project.slug,
            project.name,
            project.description,
            project.is_active,
            _comparable_time(project.created_at),
        )
        expected_project = (*expected_project[:-1], _comparable_time(expected_project[-1]))
        if actual_project != expected_project:
            raise self._conflict("project definition", expected_project, actual_project)

        expected_counts = {
            Dataset: 1,
            EvaluationCase: 5,
            DatasetVersion: 1,
            DatasetVersionCase: 5,
            Target: 1,
            TargetVersion: 4,
            Evaluator: 1,
            EvaluatorVersion: 1,
            Experiment: 4,
            EvaluationResult: 20,
            QualityGatePolicy: 1,
            QualityGateResult: 4,
            BaselineComparison: 3,
            BaselineComparisonCase: 15,
        }
        id_sets = self._expected_id_sets()
        for model, expected_count in expected_counts.items():
            identifiers = id_sets[model]
            actual_count = int(
                await self.db.scalar(select(func.count()).select_from(model).where(model.id.in_(identifiers))) or 0
            )
            if actual_count != expected_count:
                raise self._conflict(model.__tablename__, expected_count, actual_count)

        dataset = await self.db.get(Dataset, demo_uuid("dataset:release-policy"))
        expected_dataset = (
            project.id,
            "Synthetic Release Policy Evaluation",
            "Five synthetic cases for a deterministic release-quality demonstration.",
            True,
        )
        actual_dataset = (
            dataset.project_id,
            dataset.name,
            dataset.description,
            dataset.is_active,
        ) if dataset is not None else None
        if actual_dataset != expected_dataset:
            raise self._conflict("dataset definition", expected_dataset, actual_dataset)

        cases = {
            item.case_key: item
            for item in (
                await self.db.execute(select(EvaluationCase).where(EvaluationCase.id.in_(id_sets[EvaluationCase])))
            ).scalars().all()
        }
        snapshots = {
            item.case_key: item
            for item in (
                await self.db.execute(
                    select(DatasetVersionCase).where(DatasetVersionCase.id.in_(id_sets[DatasetVersionCase]))
                )
            ).scalars().all()
        }
        for spec in CASE_SPECS:
            expected_case = (
                spec["question"],
                spec["summary"],
                [{"source_id": "synthetic-policy", "content": "Demonstration-only policy evidence."}],
                [],
                [],
                spec["tags"],
                spec["severity"],
                spec["required"],
                "APPROVED",
            )
            case = cases.get(spec["key"])
            actual_case = (
                case.question,
                case.expected_summary,
                case.evidence,
                case.required_elements,
                case.forbidden_elements,
                case.tags,
                case.severity,
                case.required_for_release,
                case.status,
            ) if case is not None else None
            if actual_case != expected_case:
                raise self._conflict(f"case:{spec['key']}", expected_case, actual_case)
            snapshot = snapshots.get(spec["key"])
            actual_snapshot = (
                snapshot.question,
                snapshot.expected_summary,
                snapshot.evidence,
                snapshot.required_elements,
                snapshot.forbidden_elements,
                snapshot.tags,
                snapshot.severity,
                snapshot.required_for_release,
                snapshot.source_evaluation_case_id,
            ) if snapshot is not None else None
            expected_snapshot = (*expected_case[:-1], demo_uuid(f"case:{spec['key']}"))
            if actual_snapshot != expected_snapshot:
                raise self._conflict(f"snapshot:{spec['key']}", expected_snapshot, actual_snapshot)

        snapshot_definition = [
            {
                "case_key": spec["key"],
                "question": spec["question"],
                "expected_summary": spec["summary"],
                "required_for_release": spec["required"],
                "severity": spec["severity"],
            }
            for spec in CASE_SPECS
        ]
        dataset_version = await self.db.get(
            DatasetVersion,
            demo_uuid("dataset-version:release-policy:1"),
        )
        expected_version = (
            demo_uuid("dataset:release-policy"),
            1,
            _hash({"schema_version": 1, "cases": snapshot_definition}),
            5,
        )
        actual_version = (
            dataset_version.dataset_id,
            dataset_version.version,
            dataset_version.content_hash,
            dataset_version.case_count,
        ) if dataset_version is not None else None
        if actual_version != expected_version:
            raise self._conflict("dataset version", expected_version, actual_version)

        target = await self.db.get(Target, demo_uuid("target:demo-target"))
        expected_target = (
            project.id,
            "Demo Fixed Target",
            "MOCK",
            {"fixed_response": {"text": "Synthetic regressed response."}},
            True,
        )
        actual_target = (
            target.project_id,
            target.name,
            target.target_type,
            target.config,
            target.is_active,
        ) if target is not None else None
        if actual_target != expected_target:
            raise self._conflict("target definition", expected_target, actual_target)

        target_versions = {
            item.version: item
            for item in (
                await self.db.execute(
                    select(TargetVersion).where(TargetVersion.id.in_(id_sets[TargetVersion]))
                )
            ).scalars().all()
        }
        for version, (name, _, _) in enumerate(SCENARIOS, start=1):
            config = {"fixed_response": {"text": f"Synthetic {name} response."}}
            hash_input = {
                "schema_version": 1,
                "target_type": "MOCK",
                "config": config,
                "response_strategy": "FIXED",
                "latency_ms": 0,
                "failure_rate": 0.0,
            }
            expected_target_version = (config, "FIXED", 0, 0.0, _hash(hash_input))
            target_version = target_versions.get(version)
            actual_target_version = (
                target_version.config_snapshot,
                target_version.response_strategy,
                target_version.latency_ms,
                target_version.failure_rate,
                target_version.content_hash,
            ) if target_version is not None else None
            if actual_target_version != expected_target_version:
                raise self._conflict(
                    f"target_version:{name}",
                    expected_target_version,
                    actual_target_version,
                )

        evaluator = await self.db.get(Evaluator, demo_uuid("evaluator:demo-evaluator"))
        evaluator_config = {"expected": "synthetic", "case_sensitive": False}
        expected_evaluator = (
            project.id,
            "Demo Contains Evaluator",
            "CONTAINS",
            evaluator_config,
            True,
        )
        actual_evaluator = (
            evaluator.project_id,
            evaluator.name,
            evaluator.evaluator_type,
            evaluator.config,
            evaluator.is_active,
        ) if evaluator is not None else None
        if actual_evaluator != expected_evaluator:
            raise self._conflict("evaluator definition", expected_evaluator, actual_evaluator)

        evaluator_version = await self.db.get(
            EvaluatorVersion,
            demo_uuid("evaluator-version:demo-evaluator:1"),
        )
        expected_evaluator_version = (
            demo_uuid("evaluator:demo-evaluator"),
            1,
            "CONTAINS",
            evaluator_config,
            _hash({"schema_version": 1, "evaluator_type": "CONTAINS", "config": evaluator_config}),
        )
        actual_evaluator_version = (
            evaluator_version.evaluator_id,
            evaluator_version.version,
            evaluator_version.evaluator_type_snapshot,
            evaluator_version.config_snapshot,
            evaluator_version.content_hash,
        ) if evaluator_version is not None else None
        if actual_evaluator_version != expected_evaluator_version:
            raise self._conflict(
                "evaluator version",
                expected_evaluator_version,
                actual_evaluator_version,
            )

        policy = await self.db.get(
            QualityGatePolicy,
            demo_uuid("quality-gate-policy:demo-release-gate"),
        )
        expected_policy = (project.id, "demo-release-gate", Decimal("0.8000"), True, True, True)
        actual_policy = (
            policy.project_id,
            policy.name,
            policy.minimum_pass_rate,
            policy.block_on_error,
            policy.block_on_required_case_failure,
            policy.is_active,
        ) if policy is not None else None
        if actual_policy != expected_policy:
            raise self._conflict("quality gate policy", expected_policy, actual_policy)

        await self._validate_graph_counts(project.id, id_sets)

        experiments = (
            await self.db.execute(select(Experiment).where(Experiment.id.in_(id_sets[Experiment])))
        ).scalars().all()
        expected_experiments = {
            demo_uuid(f"experiment:{name}"): ("COMPLETED", statuses.count("PASS"), statuses.count("FAIL"), created_at)
            for name, created_at, statuses in SCENARIOS
        }
        for experiment in experiments:
            expected = expected_experiments[experiment.id]
            actual = (
                experiment.status,
                experiment.pass_count,
                experiment.fail_count,
                _comparable_time(experiment.created_at),
            )
            expected = (*expected[:-1], _comparable_time(expected[-1]))
            if actual != expected:
                raise self._conflict(f"experiment:{experiment.id}", expected, actual)

        results = (
            await self.db.execute(
                select(EvaluationResult).where(EvaluationResult.id.in_(id_sets[EvaluationResult]))
            )
        ).scalars().all()
        actual_result_statuses = {
            item.id: (item.status, item.experiment_id, item.dataset_version_case_id)
            for item in results
        }
        expected_result_statuses = {
            identifier: (
                status,
                demo_uuid(f"experiment:{name}"),
                demo_uuid(f"dataset-version-case:{spec['key']}"),
            )
            for name, _, statuses in SCENARIOS
            for spec, status in zip(CASE_SPECS, statuses, strict=True)
            for identifier in (demo_uuid(f"evaluation-result:{name}:{spec['key']}"),)
        }
        if actual_result_statuses != expected_result_statuses:
            raise self._conflict(
                "evaluation result statuses",
                expected_result_statuses,
                actual_result_statuses,
            )

        gate_statuses = {
            item.experiment_id: (
                item.status,
                item.pass_rate,
                item.passed_case_count,
                item.failed_case_count,
                item.required_case_failure_count,
                item.reason_codes,
            )
            for item in (
                await self.db.execute(select(QualityGateResult).where(QualityGateResult.id.in_(id_sets[QualityGateResult])))
            ).scalars().all()
        }
        expected_gate_statuses = {
            demo_uuid("experiment:baseline"): (
                "BLOCK", Decimal("0.6000"), 3, 2, 1,
                ["PASS_RATE_BELOW_THRESHOLD", "REQUIRED_CASE_FAILURE_PRESENT"],
            ),
            demo_uuid("experiment:improved"): ("PASS", Decimal("0.8000"), 4, 1, 0, []),
            demo_uuid("experiment:stable"): ("PASS", Decimal("0.8000"), 4, 1, 0, []),
            demo_uuid("experiment:regressed"): (
                "BLOCK", Decimal("0.4000"), 2, 3, 1,
                ["PASS_RATE_BELOW_THRESHOLD", "REQUIRED_CASE_FAILURE_PRESENT"],
            ),
        }
        if gate_statuses != expected_gate_statuses:
            raise self._conflict("quality gate statuses", expected_gate_statuses, gate_statuses)

        comparison_statuses = {
            (item.baseline_experiment_id, item.current_experiment_id): (
                item.status,
                item.improved_case_count,
                item.unchanged_case_count,
                item.regressed_case_count,
                item.pass_rate_delta,
                item.reason_codes,
            )
            for item in (
                await self.db.execute(
                    select(BaselineComparison).where(BaselineComparison.id.in_(id_sets[BaselineComparison]))
                )
            ).scalars().all()
        }
        expected_comparisons = {
            (demo_uuid("experiment:baseline"), demo_uuid("experiment:improved")): (
                "IMPROVED", 1, 4, 0, Decimal("0.2000"), ["CASE_IMPROVEMENT_PRESENT"],
            ),
            (demo_uuid("experiment:improved"), demo_uuid("experiment:stable")): (
                "UNCHANGED", 0, 5, 0, Decimal("0.0000"), ["NO_CASE_CHANGE"],
            ),
            (demo_uuid("experiment:stable"), demo_uuid("experiment:regressed")): (
                "REGRESSED", 0, 3, 2, Decimal("-0.4000"), ["CASE_REGRESSION_PRESENT"],
            ),
        }
        if comparison_statuses != expected_comparisons:
            raise self._conflict("comparison statuses", expected_comparisons, comparison_statuses)

    async def _validate_graph_counts(self, project_id: UUID, id_sets: dict[type, set[UUID]]) -> None:
        dataset_id = demo_uuid("dataset:release-policy")
        dataset_version_id = demo_uuid("dataset-version:release-policy:1")
        target_id = demo_uuid("target:demo-target")
        evaluator_id = demo_uuid("evaluator:demo-evaluator")
        policy_id = demo_uuid("quality-gate-policy:demo-release-gate")
        experiment_ids = id_sets[Experiment]
        comparison_ids = id_sets[BaselineComparison]
        checks = (
            (Dataset, Dataset.project_id == project_id, 1),
            (EvaluationCase, EvaluationCase.dataset_id == dataset_id, 5),
            (DatasetVersion, DatasetVersion.dataset_id == dataset_id, 1),
            (DatasetVersionCase, DatasetVersionCase.dataset_version_id == dataset_version_id, 5),
            (Target, Target.project_id == project_id, 1),
            (TargetVersion, TargetVersion.target_id == target_id, 4),
            (Evaluator, Evaluator.project_id == project_id, 1),
            (EvaluatorVersion, EvaluatorVersion.evaluator_id == evaluator_id, 1),
            (Experiment, Experiment.dataset_version_id == dataset_version_id, 4),
            (EvaluationResult, EvaluationResult.experiment_id.in_(experiment_ids), 20),
            (QualityGatePolicy, QualityGatePolicy.project_id == project_id, 1),
            (QualityGateResult, QualityGateResult.policy_id == policy_id, 4),
            (BaselineComparison, BaselineComparison.project_id == project_id, 3),
            (BaselineComparisonCase, BaselineComparisonCase.comparison_id.in_(comparison_ids), 15),
        )
        for model, predicate, expected in checks:
            actual = int(
                await self.db.scalar(select(func.count()).select_from(model).where(predicate)) or 0
            )
            if actual != expected:
                raise self._conflict(f"{model.__tablename__} graph count", expected, actual)

    @staticmethod
    def _expected_id_sets() -> dict[type, set[UUID]]:
        result: dict[type, set[UUID]] = {
            Dataset: {demo_uuid("dataset:release-policy")},
            EvaluationCase: {demo_uuid(f"case:{spec['key']}") for spec in CASE_SPECS},
            DatasetVersion: {demo_uuid("dataset-version:release-policy:1")},
            DatasetVersionCase: {demo_uuid(f"dataset-version-case:{spec['key']}") for spec in CASE_SPECS},
            Target: {demo_uuid("target:demo-target")},
            TargetVersion: {demo_uuid(f"target-version:{name}") for name, _, _ in SCENARIOS},
            Evaluator: {demo_uuid("evaluator:demo-evaluator")},
            EvaluatorVersion: {demo_uuid("evaluator-version:demo-evaluator:1")},
            Experiment: {demo_uuid(f"experiment:{name}") for name, _, _ in SCENARIOS},
            EvaluationResult: {
                demo_uuid(f"evaluation-result:{name}:{spec['key']}")
                for name, _, _ in SCENARIOS
                for spec in CASE_SPECS
            },
            QualityGatePolicy: {demo_uuid("quality-gate-policy:demo-release-gate")},
            QualityGateResult: {demo_uuid(f"quality-gate-result:{name}") for name, _, _ in SCENARIOS},
            BaselineComparison: {
                demo_uuid(f"comparison:{baseline}:{current}")
                for baseline, current in (("baseline", "improved"), ("improved", "stable"), ("stable", "regressed"))
            },
            BaselineComparisonCase: {
                demo_uuid(f"comparison-case:{baseline}:{current}:{spec['key']}")
                for baseline, current in (("baseline", "improved"), ("improved", "stable"), ("stable", "regressed"))
                for spec in CASE_SPECS
            },
        }
        return result
