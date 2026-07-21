from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.application.schemas.project import ProjectCreateRequest, ProjectUpdateRequest
from src.domain.models import Project


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_projects(self, page: int, size: int) -> tuple[list[Project], int]:
        stmt = select(Project).order_by(Project.created_at.desc())
        total_stmt = select(func.count()).select_from(Project)
        total_result = await self.db.execute(total_stmt)
        total = total_result.scalar_one()
        offset = (page - 1) * size
        result = await self.db.execute(stmt.offset(offset).limit(size))
        return list(result.scalars().all()), int(total)

    async def create_project(self, payload: ProjectCreateRequest) -> Project:
        exists_stmt = select(func.count()).select_from(Project).where(Project.slug == payload.slug)
        duplicated = await self.db.execute(exists_stmt)
        if duplicated.scalar_one() > 0:
            raise ErrorCodeError("DUPLICATE_SLUG", "Project slug already exists.", 409)

        project = Project(
            slug=payload.slug,
            name=payload.name,
            description=payload.description,
        )
        self.db.add(project)
        await self.db.flush()
        await self.db.refresh(project)
        await self.db.commit()
        return project

    async def get_project(self, project_id: UUID) -> Project:
        project = await self.db.get(Project, project_id)
        if not project:
            raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)
        return project

    async def update_project(self, project_id: UUID, payload: ProjectUpdateRequest) -> Project:
        project = await self.get_project(project_id)

        if payload.name is None and payload.description is None and payload.is_active is None:
            return project

        if payload.is_active is not None:
            if project.is_active and not payload.is_active:
                project.is_active = False
            elif not project.is_active and payload.is_active:
                raise ErrorCodeError(
                    "INVALID_STATE_TRANSITION",
                    "Cannot reactivate project.",
                    409,
                )
            elif not project.is_active and not payload.is_active:
                raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot be updated.", 409)
        elif not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot be updated.", 409)

        if payload.name is not None:
            project.name = payload.name
        if payload.description is not None:
            project.description = payload.description

        await self.db.flush()
        await self.db.refresh(project)
        await self.db.commit()
        return project
