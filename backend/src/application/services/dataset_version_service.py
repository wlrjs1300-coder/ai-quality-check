from __future__ import annotations

import hashlib
import json
import unicodedata
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.domain.models import CaseStatus, Dataset, DatasetVersion, DatasetVersionCase, EvaluationCase, Project


def _normalize_text(value: object) -> object:
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value.strip())
    return value


def _normalize_json_value(value: object) -> object:
    if isinstance(value, dict):
        return {k: _normalize_json_value(v) for k, v in sorted(value.items(), key=lambda item: item[0])}
    if isinstance(value, list):
        return [_normalize_json_value(item) for item in value]
    if isinstance(value, str):
        return _normalize_text(value)
    return value


def _deduplicate_and_sort_items(items: object) -> list[object]:
    if not isinstance(items, list):
        return []
    normalized = [_normalize_json_value(item) for item in items]
    seen: set[str] = set()
    deduped: list[object] = []
    for item in normalized:
        dumped = json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        if dumped in seen:
            continue
        seen.add(dumped)
        deduped.append(item)
    return sorted(deduped, key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def _sort_evidence(items: object) -> list[object]:
    if not isinstance(items, list):
        return []
    normalized = [_normalize_json_value(item) for item in items]
    return sorted(
        normalized,
        key=lambda item: (
            item.get("source_id", "") if isinstance(item, dict) else "",
            item.get("content", "") if isinstance(item, dict) else "",
            json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
        ),
    )


def _canonical_snapshot(cases: list[EvaluationCase]) -> str:
    items: list[dict[str, object]] = []
    for case in sorted(cases, key=lambda c: c.case_key):
        item: dict[str, object] = {
            "case_key": _normalize_text(case.case_key),
            "question": _normalize_text(case.question),
            "expected_summary": _normalize_text(case.expected_summary) if case.expected_summary is not None else None,
            "evidence": _sort_evidence(case.evidence),
            "required_elements": _deduplicate_and_sort_items(case.required_elements),
            "forbidden_elements": _deduplicate_and_sort_items(case.forbidden_elements),
            "tags": _deduplicate_and_sort_items(case.tags),
            "severity": case.severity,
            "required_for_release": case.required_for_release,
        }
        for key in ("case_key", "question"):
            assert isinstance(item[key], str)
        items.append(item)

    payload = {"schema_version": 1, "cases": items}
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class DatasetVersionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_dataset_with_lock(self, dataset_id: UUID) -> Dataset:
        stmt = select(Dataset).where(Dataset.id == dataset_id).with_for_update()
        result = await self.db.execute(stmt)
        dataset = result.scalar_one_or_none()
        if not dataset:
            raise ErrorCodeError("DATASET_NOT_FOUND", "Dataset not found.", 404)
        return dataset

    async def list_versions(self, dataset_id: UUID) -> list[DatasetVersion]:
        dataset = await self.db.get(Dataset, dataset_id)
        if not dataset:
            raise ErrorCodeError("DATASET_NOT_FOUND", "Dataset not found.", 404)
        result = await self.db.execute(
            select(DatasetVersion)
            .where(DatasetVersion.dataset_id == dataset_id)
            .order_by(DatasetVersion.version.desc())
        )
        return list(result.scalars().all())

    async def get_version(self, dataset_id: UUID, version: int) -> tuple[DatasetVersion, list[DatasetVersionCase]]:
        result = await self.db.execute(
            select(DatasetVersion)
            .where(DatasetVersion.dataset_id == dataset_id, DatasetVersion.version == version)
            .limit(1)
        )
        dataset_version = result.scalar_one_or_none()
        if not dataset_version:
            raise ErrorCodeError("DATASET_VERSION_NOT_FOUND", "Dataset version not found.", 404)

        cases = await self.db.execute(
            select(DatasetVersionCase)
            .where(DatasetVersionCase.dataset_version_id == dataset_version.id)
            .order_by(DatasetVersionCase.case_key.asc())
        )
        return dataset_version, list(cases.scalars().all())

    async def create_version(self, dataset_id: UUID) -> DatasetVersion:
        async with self.db.begin():
            dataset = await self._get_dataset_with_lock(dataset_id)
            project = await self.db.get(Project, dataset.project_id)
            if not project:
                raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)
            if not project.is_active:
                raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot create dataset version.", 409)
            if not dataset.is_active:
                raise ErrorCodeError("DATASET_INACTIVE", "Inactive dataset cannot create snapshot.", 409)

            result_cases = await self.db.execute(
                select(EvaluationCase)
                .where(EvaluationCase.dataset_id == dataset_id, EvaluationCase.status == CaseStatus.APPROVED)
                .order_by(EvaluationCase.case_key.asc())
            )
            cases = list(result_cases.scalars().all())
            if not cases:
                raise ErrorCodeError("NO_APPROVED_CASES", "No approved evaluation case exists.", 409)

            content_hash = _canonical_snapshot(cases)
            existing = await self.db.execute(
                select(DatasetVersion).where(
                    DatasetVersion.dataset_id == dataset_id,
                    DatasetVersion.content_hash == content_hash,
                )
            )
            existing_version = existing.scalar_one_or_none()
            if existing_version is not None:
                raise ErrorCodeError(
                    "DUPLICATE_DATASET_VERSION",
                    "A dataset version with identical snapshot already exists.",
                    409,
                    details={"dataset_version_id": str(existing_version.id), "version": existing_version.version},
                )

            current_max = await self.db.execute(
                select(func.coalesce(func.max(DatasetVersion.version), 0)).where(
                    DatasetVersion.dataset_id == dataset_id,
                )
            )
            current_max_version = int(current_max.scalar_one() or 0)
            version = current_max_version + 1
            if version < 1:
                raise ErrorCodeError("VERSION_NUMBER_CONFLICT", "Invalid version number.", 409)

            version_row = DatasetVersion(
                dataset_id=dataset_id,
                version=version,
                content_hash=content_hash,
                case_count=len(cases),
            )
            self.db.add(version_row)
            try:
                await self.db.flush()
            except IntegrityError as exc:
                await self.db.rollback()
                raise ErrorCodeError("VERSION_NUMBER_CONFLICT", "Version number conflict.", 409) from exc

            for case in cases:
                snapshot = DatasetVersionCase(
                    dataset_version_id=version_row.id,
                    source_evaluation_case_id=case.id,
                    case_key=case.case_key,
                    question=case.question,
                    expected_summary=case.expected_summary,
                    evidence=case.evidence,
                    required_elements=case.required_elements,
                    forbidden_elements=case.forbidden_elements,
                    tags=case.tags,
                    severity=case.severity,
                    required_for_release=case.required_for_release,
                )
                self.db.add(snapshot)

            await self.db.flush()
        return version_row
