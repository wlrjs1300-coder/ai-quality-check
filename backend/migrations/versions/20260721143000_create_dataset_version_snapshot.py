"""Create dataset version snapshot tables."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260721143000"
down_revision = "20260721121027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dataset_versions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("dataset_id", sa.Uuid(as_uuid=True), sa.ForeignKey("datasets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("case_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("dataset_id", "version", name="uq_dataset_versions_dataset_version"),
        sa.UniqueConstraint("dataset_id", "content_hash", name="uq_dataset_versions_dataset_content_hash"),
        sa.CheckConstraint("version >= 1"),
        sa.CheckConstraint("case_count >= 1"),
    )

    op.create_table(
        "dataset_version_cases",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "dataset_version_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("dataset_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "source_evaluation_case_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("evaluation_cases.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("case_key", sa.String(length=120), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("expected_summary", sa.Text(), nullable=True),
        sa.Column(
            "evidence",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "required_elements",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "forbidden_elements",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column(
            "tags",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("required_for_release", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("dataset_version_id", "case_key", name="uq_dataset_version_cases_version_case_key"),
        sa.CheckConstraint(
            "severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')",
        ),
    )


def downgrade() -> None:
    op.drop_table("dataset_version_cases")
    op.drop_table("dataset_versions")
