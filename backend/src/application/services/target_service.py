from __future__ import annotations

import hashlib
import json
import unicodedata

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.application.schemas.target import TargetCreateRequest, TargetUpdateRequest
from src.domain.models import Project, Target, TargetVersion


def _normalize_value(value):
    if isinstance(value, dict):
        return {key: _normalize_value(value[key]) for key in sorted(value.keys())}
    if isinstance(value, list):
        return [_normalize_value(item) for item in value]
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    return value


def _make_target_version_snapshot(target: Target) -> tuple[str, dict]:
    config_snapshot = _normalize_value(target.config)
    snapshot = {
        "schema_version": 1,
        "target_type": target.target_type,
        "config": config_snapshot,
        "response_strategy": "FIXED",
        "latency_ms": 0,
        "failure_rate": 0.0,
    }
    content_hash = hashlib.sha256(
        json.dumps(snapshot, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"),
    ).hexdigest()
    return content_hash, config_snapshot


class TargetService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_target(self, project_id, payload: TargetCreateRequest) -> Target:
        project = await self.db.get(Project, project_id)
        if not project:
            raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)
        if not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot create target.", 409)

        if payload.target_type != "MOCK":
            raise ErrorCodeError("UNSUPPORTED_TARGET_TYPE", "Only MOCK target type is supported.", 422)

        exists = await self.db.execute(
            select(func.count()).select_from(Target).where(
                Target.project_id == project_id,
                Target.name == payload.name,
            )
        )
        if exists.scalar_one() > 0:
            raise ErrorCodeError("DUPLICATE_TARGET_NAME_IN_PROJECT", "Target name already exists in project.", 409)

        target = Target(
            project_id=project_id,
            name=payload.name,
            target_type=payload.target_type,
            config=payload.config,
        )
        self.db.add(target)
        try:
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ErrorCodeError(
                "DUPLICATE_TARGET_NAME_IN_PROJECT",
                "Target name already exists in project.",
                409,
            ) from exc
        await self.db.refresh(target)
        await self.db.commit()
        return target

    async def get_target(self, target_id):
        target = await self.db.get(Target, target_id)
        if not target:
            raise ErrorCodeError("TARGET_NOT_FOUND", "Target not found.", 404)
        return target

    async def list_targets(self, project_id):
        project = await self.db.get(Project, project_id)
        if not project:
            raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)
        result = await self.db.execute(
            select(Target).where(Target.project_id == project_id).order_by(Target.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_target(self, target_id, payload: TargetUpdateRequest) -> Target:
        target = await self.get_target(target_id)
        project = await self.db.get(Project, target.project_id)
        if project is not None and not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot update target.", 409)

        was_active = target.is_active
        if not was_active:
            if payload.is_active is True:
                raise ErrorCodeError("INVALID_STATE_TRANSITION", "Cannot reactivate target.", 409)
            raise ErrorCodeError("TARGET_INACTIVE", "Inactive target cannot be updated.", 409)

        if payload.is_active is not None and payload.is_active is False:
            target.is_active = False

        if payload.name is not None:
            exists = await self.db.execute(
                select(func.count()).select_from(Target).where(
                    Target.project_id == target.project_id,
                    Target.name == payload.name,
                    Target.id != target_id,
                )
            )
            if exists.scalar_one() > 0:
                raise ErrorCodeError("DUPLICATE_TARGET_NAME_IN_PROJECT", "Target name already exists in project.", 409)
            target.name = payload.name

        if payload.config is not None:
            target.config = payload.config

        try:
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ErrorCodeError(
                "DUPLICATE_TARGET_NAME_IN_PROJECT",
                "Target name already exists in project.",
                409,
            ) from exc
        await self.db.refresh(target)
        await self.db.commit()
        return target

    async def list_versions(self, target_id):
        target = await self.db.get(Target, target_id)
        if not target:
            raise ErrorCodeError("TARGET_NOT_FOUND", "Target not found.", 404)
        result = await self.db.execute(
            select(TargetVersion).where(TargetVersion.target_id == target_id).order_by(TargetVersion.version.desc())
        )
        return list(result.scalars().all())

    async def get_version(self, target_id, version: int) -> TargetVersion:
        version_row = await self.db.execute(
            select(TargetVersion).where(
                TargetVersion.target_id == target_id,
                TargetVersion.version == version,
            )
        )
        target_version = version_row.scalar_one_or_none()
        if target_version is None:
            raise ErrorCodeError("TARGET_VERSION_NOT_FOUND", "Target version not found.", 404)
        return target_version

    async def get_version_by_id(self, version_id) -> TargetVersion:
        version_row = await self.db.execute(
            select(TargetVersion).where(TargetVersion.id == version_id).limit(1)
        )
        target_version = version_row.scalar_one_or_none()
        if target_version is None:
            raise ErrorCodeError("TARGET_VERSION_NOT_FOUND", "Target version not found.", 404)
        return target_version

    async def create_version(self, target_id) -> TargetVersion:
        async with self.db.begin():
            target = await self.db.execute(
                select(Target)
                .where(Target.id == target_id)
                .with_for_update()
            )
            target_obj = target.scalar_one_or_none()
            if target_obj is None:
                raise ErrorCodeError("TARGET_NOT_FOUND", "Target not found.", 404)

            project = await self.db.get(Project, target_obj.project_id)
            if not project:
                raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)
            if not project.is_active:
                raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot create target version.", 409)
            if not target_obj.is_active:
                raise ErrorCodeError("TARGET_INACTIVE", "Inactive target cannot create version.", 409)

            content_hash, config_snapshot = _make_target_version_snapshot(target_obj)

            existing = await self.db.execute(
                select(TargetVersion).where(
                    TargetVersion.target_id == target_id,
                    TargetVersion.content_hash == content_hash,
                )
            )
            duplicate = existing.scalar_one_or_none()
            if duplicate is not None:
                raise ErrorCodeError(
                    "DUPLICATE_TARGET_VERSION",
                    "A target version with identical snapshot already exists.",
                    409,
                    details={"target_version_id": str(duplicate.id), "version": duplicate.version},
                )

            current_max = await self.db.execute(
                select(func.coalesce(func.max(TargetVersion.version), 0)).where(TargetVersion.target_id == target_id)
            )
            version_number = int(current_max.scalar_one() or 0) + 1

            row = TargetVersion(
                target_id=target_id,
                version=version_number,
                content_hash=content_hash,
                config_snapshot=config_snapshot,
                response_strategy="FIXED",
                latency_ms=0,
                failure_rate=0.0,
            )
            self.db.add(row)
            try:
                await self.db.flush()
            except IntegrityError as exc:
                await self.db.rollback()
                raise ErrorCodeError(
                    "VERSION_NUMBER_CONFLICT",
                    "Target version number conflict.",
                    409,
                ) from exc

            return row
