from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy import Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.domain.models.base import Base
from src.domain.models.enums import CaseSeverity


class DatasetVersionCase(Base):  # type: ignore
    __tablename__ = "dataset_version_cases"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_version_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("dataset_versions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    source_evaluation_case_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("evaluation_cases.id", ondelete="RESTRICT"),
        nullable=False,
    )
    case_key: Mapped[str] = mapped_column(String(120), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    expected_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    _json_type = JSON().with_variant(JSONB(), "postgresql")

    evidence: Mapped[list[dict] | list | dict] = mapped_column(_json_type, nullable=False)
    required_elements: Mapped[list[dict] | list] = mapped_column(_json_type, nullable=False)
    forbidden_elements: Mapped[list[dict] | list] = mapped_column(_json_type, nullable=False)
    tags: Mapped[list[dict] | list] = mapped_column(_json_type, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    required_for_release: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("dataset_version_id", "case_key", name="uq_dataset_version_cases_version_case_key"),
        CheckConstraint(
            f"severity IN ('{CaseSeverity.CRITICAL}','{CaseSeverity.HIGH}','{CaseSeverity.MEDIUM}','{CaseSeverity.LOW}')"
        ),
    )

    dataset_version = relationship("DatasetVersion", back_populates="cases")
