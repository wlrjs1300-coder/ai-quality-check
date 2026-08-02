from __future__ import annotations

import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.domain.models.base import Base, TimestampMixin
from src.domain.models.enums import CaseStatus, CaseSeverity


class EvaluationCase(Base, TimestampMixin):
    __tablename__ = "evaluation_cases"

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("datasets.id", ondelete="RESTRICT"),
        nullable=False,
    )
    case_key: Mapped[str] = mapped_column(String(120), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    expected_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    _json_type = JSON().with_variant(JSONB(), "postgresql")

    evidence: Mapped[list[dict] | list | dict] = mapped_column(_json_type, nullable=False, default=list)
    required_elements: Mapped[list[dict] | list] = mapped_column(_json_type, nullable=False, default=list)
    forbidden_elements: Mapped[list[dict] | list] = mapped_column(_json_type, nullable=False, default=list)
    tags: Mapped[list[dict] | list] = mapped_column(_json_type, nullable=False, default=list)
    severity: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=CaseSeverity.MEDIUM.value,
        server_default=CaseSeverity.MEDIUM.value,
    )
    required_for_release: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=CaseStatus.DRAFT.value,
        server_default=CaseStatus.DRAFT.value,
    )

    __table_args__ = (
        UniqueConstraint("dataset_id", "case_key", name="uq_evaluation_cases_dataset_case_key"),
        CheckConstraint(f"status IN ('{CaseStatus.DRAFT}','{CaseStatus.APPROVED}','{CaseStatus.DEPRECATED}')"),
        CheckConstraint(
            f"severity IN ('{CaseSeverity.CRITICAL}','{CaseSeverity.HIGH}','{CaseSeverity.MEDIUM}','{CaseSeverity.LOW}')"
        ),
    )

    dataset = relationship("Dataset", back_populates="evaluation_cases")
