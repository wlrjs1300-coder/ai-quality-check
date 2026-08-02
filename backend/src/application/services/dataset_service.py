from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.application.schemas.dataset import DatasetCreateRequest, DatasetUpdateRequest
from src.domain.models import Dataset, Project


class DatasetService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_datasets(self, project_id: UUID, page: int, size: int) -> tuple[list[Dataset], int]:
        project = await self.db.get(Project, project_id)
        if not project:
            raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)

        stmt = select(Dataset).where(Dataset.project_id == project_id).order_by(Dataset.created_at.desc())
        total_stmt = select(func.count()).select_from(Dataset).where(Dataset.project_id == project_id)
        total = (await self.db.execute(total_stmt)).scalar_one()
        offset = (page - 1) * size
        result = await self.db.execute(stmt.offset(offset).limit(size))
        return list(result.scalars().all()), int(total)

    async def create_dataset(self, project_id: UUID, payload: DatasetCreateRequest) -> Dataset:
        project = await self.db.get(Project, project_id)
        if not project:
            raise ErrorCodeError("PROJECT_NOT_FOUND", "Project not found.", 404)
        if not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot create dataset.", 409)

        exists = await self.db.execute(select(func.count()).select_from(Dataset).where(
            Dataset.project_id == project_id,
            Dataset.name == payload.name,
        ))
        if exists.scalar_one() > 0:
            raise ErrorCodeError("DUPLICATE_DATASET_NAME_IN_PROJECT", "Dataset name already exists in project.", 409)

        dataset = Dataset(project_id=project_id, name=payload.name, description=payload.description)
        self.db.add(dataset)
        await self.db.flush()
        await self.db.refresh(dataset)
        await self.db.commit()
        return dataset

    async def get_dataset(self, dataset_id: UUID) -> Dataset:
        dataset = await self.db.get(Dataset, dataset_id)
        if not dataset:
            raise ErrorCodeError("DATASET_NOT_FOUND", "Dataset not found.", 404)
        return dataset

    async def update_dataset(self, dataset_id: UUID, payload: DatasetUpdateRequest) -> Dataset:
        dataset = await self.get_dataset(dataset_id)
        project = await self.db.get(Project, dataset.project_id)
        if project is not None and not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot update dataset.", 409)

        if payload.is_active is not None and (not dataset.is_active and payload.is_active):
            raise ErrorCodeError("INVALID_STATE_TRANSITION", "Cannot reactivate dataset.", 409)
        if not dataset.is_active and payload.is_active is None:
            raise ErrorCodeError("DATASET_INACTIVE", "Inactive dataset cannot be updated.", 409)

        if payload.name is not None:
            duplicate_stmt = (
                select(func.count())
                .select_from(Dataset)
                .where(Dataset.project_id == dataset.project_id, Dataset.name == payload.name, Dataset.id != dataset_id)
            )
            duplicate = await self.db.execute(duplicate_stmt)
            if duplicate.scalar_one() > 0:
                raise ErrorCodeError(
                    "DUPLICATE_DATASET_NAME_IN_PROJECT",
                    "Dataset name already exists in project.",
                    409,
                )
            dataset.name = payload.name
        if payload.description is not None:
            dataset.description = payload.description
        if payload.is_active is not None:
            if dataset.is_active and not payload.is_active:
                dataset.is_active = False

        await self.db.flush()
        await self.db.refresh(dataset)
        await self.db.commit()
        return dataset
