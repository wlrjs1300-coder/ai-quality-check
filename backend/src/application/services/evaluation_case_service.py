from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.errors import ErrorCodeError
from src.application.schemas.evaluation_case import EvaluationCaseCreateRequest, EvaluationCaseUpdateRequest
from src.domain.models import CaseStatus, Dataset, EvaluationCase, Project


class EvaluationCaseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_cases(self, dataset_id: UUID, page: int, size: int) -> tuple[list[EvaluationCase], int]:
        dataset = await self.db.get(Dataset, dataset_id)
        if not dataset:
            raise ErrorCodeError("DATASET_NOT_FOUND", "Dataset not found.", 404)

        stmt = select(EvaluationCase).where(EvaluationCase.dataset_id == dataset_id).order_by(EvaluationCase.created_at.desc())
        total_stmt = select(func.count()).select_from(EvaluationCase).where(EvaluationCase.dataset_id == dataset_id)
        total = (await self.db.execute(total_stmt)).scalar_one()
        offset = (page - 1) * size
        result = await self.db.execute(stmt.offset(offset).limit(size))
        return list(result.scalars().all()), int(total)

    async def create_case(self, dataset_id: UUID, payload: EvaluationCaseCreateRequest) -> EvaluationCase:
        dataset = await self.db.get(Dataset, dataset_id)
        if not dataset:
            raise ErrorCodeError("DATASET_NOT_FOUND", "Dataset not found.", 404)

        project = await self.db.get(Project, dataset.project_id)
        if project is not None and not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot create case.", 409)

        if not dataset.is_active:
            raise ErrorCodeError("DATASET_INACTIVE", "Inactive dataset cannot create case.", 409)

        duplicate_stmt = select(func.count()).select_from(EvaluationCase).where(
            EvaluationCase.dataset_id == dataset_id,
            EvaluationCase.case_key == payload.case_key,
        )
        duplicated = (await self.db.execute(duplicate_stmt)).scalar_one()
        if duplicated > 0:
            raise ErrorCodeError("DUPLICATE_CASE_KEY_IN_DATASET", "Case key already exists in dataset.", 409)

        evaluation_case = EvaluationCase(
            dataset_id=dataset_id,
            case_key=payload.case_key,
            question=payload.question,
            expected_summary=payload.expected_summary,
            evidence=payload.evidence,
            required_elements=payload.required_elements,
            forbidden_elements=payload.forbidden_elements,
            tags=payload.tags,
            severity=payload.severity.value,
            required_for_release=payload.required_for_release,
        )
        self.db.add(evaluation_case)
        await self.db.flush()
        await self.db.refresh(evaluation_case)
        await self.db.commit()
        return evaluation_case

    async def get_case(self, case_id: UUID) -> EvaluationCase:
        evaluation_case = await self.db.get(EvaluationCase, case_id)
        if not evaluation_case:
            raise ErrorCodeError("EVALUATION_CASE_NOT_FOUND", "Evaluation case not found.", 404)
        return evaluation_case

    async def update_case(self, case_id: UUID, payload: EvaluationCaseUpdateRequest) -> EvaluationCase:
        evaluation_case = await self.get_case(case_id)
        if evaluation_case.status != CaseStatus.DRAFT:
            raise ErrorCodeError("RESOURCE_IMMUTABLE", "Cannot modify non-draft evaluation case.", 409)

        dataset = await self.db.get(Dataset, evaluation_case.dataset_id)
        project = await self.db.get(Project, dataset.project_id) if dataset else None
        if project is not None and not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot modify case.", 409)
        if dataset and not dataset.is_active:
            raise ErrorCodeError("DATASET_INACTIVE", "Inactive dataset cannot modify case.", 409)

        if payload.question is not None:
            evaluation_case.question = payload.question
        if payload.expected_summary is not None:
            evaluation_case.expected_summary = payload.expected_summary
        if payload.evidence is not None:
            evaluation_case.evidence = payload.evidence
        if payload.required_elements is not None:
            evaluation_case.required_elements = payload.required_elements
        if payload.forbidden_elements is not None:
            evaluation_case.forbidden_elements = payload.forbidden_elements
        if payload.tags is not None:
            evaluation_case.tags = payload.tags
        if payload.severity is not None:
            evaluation_case.severity = payload.severity.value
        if payload.required_for_release is not None:
            evaluation_case.required_for_release = payload.required_for_release

        await self.db.flush()
        await self.db.refresh(evaluation_case)
        await self.db.commit()
        return evaluation_case

    async def approve_case(self, case_id: UUID) -> EvaluationCase:
        evaluation_case = await self.get_case(case_id)
        dataset = await self.db.get(Dataset, evaluation_case.dataset_id)
        project = await self.db.get(Project, dataset.project_id) if dataset else None
        if project is not None and not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot approve case.", 409)
        if not dataset or not dataset.is_active:
            raise ErrorCodeError("DATASET_INACTIVE", "Inactive dataset cannot approve case.", 409)
        if evaluation_case.status != CaseStatus.DRAFT:
            raise ErrorCodeError("INVALID_STATE_TRANSITION", "Only draft case can be approved.", 409)
        evaluation_case.status = CaseStatus.APPROVED
        await self.db.flush()
        await self.db.refresh(evaluation_case)
        await self.db.commit()
        return evaluation_case

    async def deprecate_case(self, case_id: UUID) -> EvaluationCase:
        evaluation_case = await self.get_case(case_id)
        dataset = await self.db.get(Dataset, evaluation_case.dataset_id)
        project = await self.db.get(Project, dataset.project_id) if dataset else None
        if project is not None and not project.is_active:
            raise ErrorCodeError("PROJECT_INACTIVE", "Inactive project cannot deprecate case.", 409)
        if not dataset or not dataset.is_active:
            raise ErrorCodeError("DATASET_INACTIVE", "Inactive dataset cannot deprecate case.", 409)
        if evaluation_case.status == CaseStatus.DEPRECATED:
            raise ErrorCodeError("INVALID_STATE_TRANSITION", "Case is already deprecated.", 409)
        evaluation_case.status = CaseStatus.DEPRECATED
        await self.db.flush()
        await self.db.refresh(evaluation_case)
        await self.db.commit()
        return evaluation_case
