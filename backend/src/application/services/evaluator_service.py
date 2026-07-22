from __future__ import annotations

import hashlib
import json
import re
import unicodedata

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.application.schemas.evaluator import EvaluatorCreateRequest, EvaluatorUpdateRequest
from src.domain.models import Evaluator, EvaluatorVersion, Project


def _normalize_value(value):
    if isinstance(value, dict):
        return {key: _normalize_value(value[key]) for key in sorted(value.keys())}
    if isinstance(value, list):
        return [_normalize_value(item) for item in value]
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    return value


def _make_evaluator_version_snapshot(evaluator: Evaluator) -> tuple[str, dict]:
    config_snapshot = _normalize_value(evaluator.config)
    snapshot = {
        "schema_version": 1,
        "evaluator_type": evaluator.evaluator_type,
        "config": config_snapshot,
    }
    content_hash = hashlib.sha256(
        json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"),
    ).hexdigest()
    return content_hash, config_snapshot


class EvaluatorService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_evaluator(self, project_id, payload: EvaluatorCreateRequest) -> Evaluator:
        project = await self.db.get(Project, project_id)
        if not project:
            raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)
        if not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot create evaluator.", 409)

        evaluator = Evaluator(
            project_id=project_id,
            name=payload.name,
            evaluator_type=payload.evaluator_type,
            config=payload.config,
        )
        self.db.add(evaluator)
        try:
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ErrorCodeError(
                "DUPLICATE_EVALUATOR_NAME_IN_PROJECT",
                "Evaluator name already exists in project.",
                409,
            ) from exc

        await self.db.refresh(evaluator)
        await self.db.commit()
        return evaluator

    async def get_evaluator(self, evaluator_id):
        evaluator = await self.db.get(Evaluator, evaluator_id)
        if not evaluator:
            raise ErrorCodeError("EVALUATOR_NOT_FOUND", "Evaluator not found.", 404)
        return evaluator

    async def list_evaluators(self, project_id):
        project = await self.db.get(Project, project_id)
        if not project:
            raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)
        result = await self.db.execute(select(Evaluator).where(Evaluator.project_id == project_id))
        return list(result.scalars().all())

    async def update_evaluator(self, evaluator_id, payload: EvaluatorUpdateRequest) -> Evaluator:
        evaluator = await self.get_evaluator(evaluator_id)
        project = await self.db.get(Project, evaluator.project_id)
        if project is not None and not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot update evaluator.", 409)

        was_active = evaluator.is_active
        if not was_active:
            if payload.is_active is True:
                raise ErrorCodeError("INVALID_STATE_TRANSITION", "Cannot reactivate evaluator.", 409)
            raise ErrorCodeError("EVALUATOR_INACTIVE", "Inactive evaluator cannot be updated.", 409)

        if payload.name is not None:
            duplicate_stmt = (
                select(func.count())
                .select_from(Evaluator)
                .where(Evaluator.project_id == evaluator.project_id, Evaluator.name == payload.name, Evaluator.id != evaluator_id)
            )
            duplicate = await self.db.execute(duplicate_stmt)
            if duplicate.scalar_one() > 0:
                raise ErrorCodeError(
                    "DUPLICATE_EVALUATOR_NAME_IN_PROJECT",
                    "Evaluator name already exists in project.",
                    409,
                )
            evaluator.name = payload.name

        if payload.config is not None:
            evaluator.config = payload.config

        if payload.is_active is not None:
            evaluator.is_active = payload.is_active

        try:
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ErrorCodeError(
                "DUPLICATE_EVALUATOR_NAME_IN_PROJECT",
                "Evaluator name already exists in project.",
                409,
            ) from exc

        await self.db.refresh(evaluator)
        await self.db.commit()
        return evaluator

    async def list_versions(self, evaluator_id):
        evaluator = await self.db.get(Evaluator, evaluator_id)
        if not evaluator:
            raise ErrorCodeError("EVALUATOR_NOT_FOUND", "Evaluator not found.", 404)
        result = await self.db.execute(
            select(EvaluatorVersion).where(EvaluatorVersion.evaluator_id == evaluator_id).order_by(EvaluatorVersion.version.desc())
        )
        return list(result.scalars().all())

    async def get_version(self, evaluator_id, version: int) -> EvaluatorVersion:
        row = await self.db.execute(
            select(EvaluatorVersion).where(
                EvaluatorVersion.evaluator_id == evaluator_id,
                EvaluatorVersion.version == version,
            )
        )
        evaluator_version = row.scalar_one_or_none()
        if evaluator_version is None:
            raise ErrorCodeError("EVALUATOR_VERSION_NOT_FOUND", "Evaluator version not found.", 404)
        return evaluator_version

    async def get_version_by_id(self, version_id) -> EvaluatorVersion:
        row = await self.db.execute(select(EvaluatorVersion).where(EvaluatorVersion.id == version_id).limit(1))
        evaluator_version = row.scalar_one_or_none()
        if evaluator_version is None:
            raise ErrorCodeError("EVALUATOR_VERSION_NOT_FOUND", "Evaluator version not found.", 404)
        return evaluator_version

    async def create_version(self, evaluator_id) -> EvaluatorVersion:
        async with self.db.begin():
            evaluator = await self.db.execute(
                select(Evaluator).where(Evaluator.id == evaluator_id).with_for_update()
            )
            evaluator_obj = evaluator.scalar_one_or_none()
            if evaluator_obj is None:
                raise ErrorCodeError("EVALUATOR_NOT_FOUND", "Evaluator not found.", 404)

            project = await self.db.get(Project, evaluator_obj.project_id)
            if not project:
                raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)
            if not project.is_active:
                raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot create evaluator version.", 409)
            if not evaluator_obj.is_active:
                raise ErrorCodeError("EVALUATOR_INACTIVE", "Inactive evaluator cannot create version.", 409)

            content_hash, config_snapshot = _make_evaluator_version_snapshot(evaluator_obj)

            duplicate = await self.db.execute(
                select(EvaluatorVersion).where(
                    EvaluatorVersion.evaluator_id == evaluator_id,
                    EvaluatorVersion.content_hash == content_hash,
                )
            )
            duplicate_row = duplicate.scalar_one_or_none()
            if duplicate_row is not None:
                raise ErrorCodeError(
                    "DUPLICATE_EVALUATOR_VERSION",
                    "An evaluator version with identical snapshot already exists.",
                    409,
                    details={"evaluator_version_id": str(duplicate_row.id), "version": duplicate_row.version},
                )

            current_max = await self.db.execute(
                select(func.coalesce(func.max(EvaluatorVersion.version), 0)).where(
                    EvaluatorVersion.evaluator_id == evaluator_id
                )
            )
            version_number = int(current_max.scalar_one() or 0) + 1

            row = EvaluatorVersion(
                evaluator_id=evaluator_id,
                version=version_number,
                content_hash=content_hash,
                evaluator_type_snapshot=evaluator_obj.evaluator_type,
                config_snapshot=config_snapshot,
            )
            self.db.add(row)
            try:
                await self.db.flush()
            except IntegrityError as exc:
                await self.db.rollback()
                raise ErrorCodeError(
                    "VERSION_NUMBER_CONFLICT",
                    "Evaluator version number conflict.",
                    409,
                ) from exc

            return row

    async def execute_version(self, version_id, payload: dict) -> dict:
        version = await self.get_version_by_id(version_id)

        if version.evaluator_type_snapshot not in {"CONTAINS", "NOT_CONTAINS", "REGEX"}:
            raise ErrorCodeError(
                "UNSUPPORTED_EVALUATOR_TYPE",
                "Unsupported evaluator type snapshot.",
                409,
            )

        snapshot_config = version.config_snapshot
        if not isinstance(snapshot_config, dict):
            raise ErrorCodeError(
                "INVALID_EVALUATOR_CONFIGURATION",
                "Evaluator version snapshot config must be an object.",
                409,
            )
        output_text = payload.get("text") if isinstance(payload, dict) else None
        if not isinstance(output_text, str):
            raise ErrorCodeError(
                "INVALID_EVALUATOR_CONFIGURATION",
                "Output payload must include text as string.",
                409,
            )

        status, reason_code, reason = self._evaluate(version.evaluator_type_snapshot, snapshot_config, output_text)

        return {
            "evaluator_version_id": version.id,
            "evaluator_type": version.evaluator_type_snapshot,
            "status": status,
            "reason_code": reason_code,
            "reason": reason,
        }

    @staticmethod
    def _evaluate_contains(expected: str, actual: str, case_sensitive: bool = False) -> tuple[str, str | None, str | None]:
        expected_text = expected
        actual_text = actual
        if not case_sensitive:
            expected_text = unicodedata.normalize("NFC", expected_text).casefold()
            actual_text = unicodedata.normalize("NFC", actual_text).casefold()
        if expected_text in actual_text:
            return "PASS", None, None
        return "FAIL", "EXPECTED_TEXT_NOT_FOUND", "Expected text not found in output."

    @staticmethod
    def _evaluate_not_contains(forbidden: str, actual: str, case_sensitive: bool = False) -> tuple[str, str | None, str | None]:
        forbidden_text = forbidden
        actual_text = actual
        if not case_sensitive:
            forbidden_text = unicodedata.normalize("NFC", forbidden_text).casefold()
            actual_text = unicodedata.normalize("NFC", actual_text).casefold()
        if forbidden_text in actual_text:
            return "FAIL", "FORBIDDEN_TEXT_FOUND", "Forbidden text found in output."
        return "PASS", None, None

    @staticmethod
    def _evaluate_regex(pattern: str, actual: str, flags: list[str] | None = None) -> tuple[str, str | None, str | None]:
        if flags is None:
            flags = []

        flags_map = {"IGNORECASE": re.IGNORECASE, "MULTILINE": re.MULTILINE, "DOTALL": re.DOTALL}
        re_flags = 0
        for flag in flags:
            if not isinstance(flag, str) or flag not in flags_map:
                raise ErrorCodeError(
                    "INVALID_EVALUATOR_CONFIGURATION",
                    "Unsupported regex flag.",
                    409,
                )
            re_flags |= flags_map[flag]

        try:
            compiled = re.compile(pattern, flags=re_flags)
        except re.error as exc:
            raise ErrorCodeError(
                "INVALID_EVALUATOR_CONFIGURATION",
                "Invalid regex pattern.",
                409,
            ) from exc

        if compiled.search(actual):
            return "PASS", None, None
        return "FAIL", "REGEX_NOT_MATCHED", "Regex pattern not matched."

    @staticmethod
    def _validate_config(evaluator_type: str, config: dict) -> None:
        if evaluator_type == "CONTAINS":
            expected = config.get("expected")
            if not isinstance(expected, str) or not expected:
                raise ErrorCodeError(
                    "INVALID_EVALUATOR_CONFIGURATION",
                    "expected must be a non-empty string.",
                    409,
                )
            case_sensitive = config.get("case_sensitive", False)
            if not isinstance(case_sensitive, bool):
                raise ErrorCodeError(
                    "INVALID_EVALUATOR_CONFIGURATION",
                    "case_sensitive must be a boolean.",
                    409,
                )
        elif evaluator_type == "NOT_CONTAINS":
            forbidden = config.get("forbidden")
            if not isinstance(forbidden, str) or not forbidden:
                raise ErrorCodeError(
                    "INVALID_EVALUATOR_CONFIGURATION",
                    "forbidden must be a non-empty string.",
                    409,
                )
            case_sensitive = config.get("case_sensitive", False)
            if not isinstance(case_sensitive, bool):
                raise ErrorCodeError(
                    "INVALID_EVALUATOR_CONFIGURATION",
                    "case_sensitive must be a boolean.",
                    409,
                )
        elif evaluator_type == "REGEX":
            pattern = config.get("pattern")
            if not isinstance(pattern, str) or not pattern:
                raise ErrorCodeError(
                    "INVALID_EVALUATOR_CONFIGURATION",
                    "pattern must be a non-empty string.",
                    409,
                )
            flags = config.get("flags", [])
            if not isinstance(flags, list):
                raise ErrorCodeError("INVALID_EVALUATOR_CONFIGURATION", "flags must be a list.", 409)
            for flag in flags:
                if not isinstance(flag, str):
                    raise ErrorCodeError("INVALID_EVALUATOR_CONFIGURATION", "flags must contain strings.", 409)

    def _evaluate(self, evaluator_type: str, config_snapshot: dict, text: str) -> tuple[str, str | None, str | None]:
        self._validate_config(evaluator_type, config_snapshot)
        if evaluator_type == "CONTAINS":
            config = self._eval_contains_config(config_snapshot)
            return self._evaluate_contains(config["expected"], text, config["case_sensitive"])
        if evaluator_type == "NOT_CONTAINS":
            config = self._eval_not_contains_config(config_snapshot)
            return self._evaluate_not_contains(config["forbidden"], text, config["case_sensitive"])
        if evaluator_type == "REGEX":
            config = self._eval_regex_config(config_snapshot)
            return self._evaluate_regex(config["pattern"], text, config["flags"])
        raise ErrorCodeError("UNSUPPORTED_EVALUATOR_TYPE", "Unsupported evaluator type.", 409)

    @staticmethod
    def _eval_contains_config(config: dict) -> dict[str, bool | str]:
        return {"expected": unicodedata.normalize("NFC", str(config["expected"])), "case_sensitive": bool(config.get("case_sensitive", False))}

    @staticmethod
    def _eval_not_contains_config(config: dict) -> dict[str, bool | str]:
        return {
            "forbidden": unicodedata.normalize("NFC", str(config["forbidden"])),
            "case_sensitive": bool(config.get("case_sensitive", False)),
        }

    @staticmethod
    def _eval_regex_config(config: dict) -> dict[str, str | list[str]]:
        return {
            "pattern": unicodedata.normalize("NFC", str(config["pattern"])),
            "flags": config.get("flags", []),
        }
