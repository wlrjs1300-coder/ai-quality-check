"""Create evaluator registry and immutable evaluator version tables."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260721153000"
down_revision = "20260721150000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "evaluators",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("project_id", sa.Uuid(as_uuid=True), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("evaluator_type", sa.String(length=16), nullable=False),
        sa.Column(
            "config",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("project_id", "name", name="uq_evaluators_project_name"),
        sa.CheckConstraint("length(trim(name)) > 0"),
        sa.CheckConstraint("evaluator_type IN ('CONTAINS', 'NOT_CONTAINS', 'REGEX')"),
    )

    op.create_table(
        "evaluator_versions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "evaluator_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("evaluators.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("evaluator_type_snapshot", sa.String(length=16), nullable=False),
        sa.Column(
            "config_snapshot",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("evaluator_id", "version", name="uq_evaluator_versions_evaluator_version"),
        sa.UniqueConstraint("evaluator_id", "content_hash", name="uq_evaluator_versions_evaluator_content_hash"),
        sa.CheckConstraint("version >= 1"),
        sa.CheckConstraint("evaluator_type_snapshot IN ('CONTAINS', 'NOT_CONTAINS', 'REGEX')"),
    )


def downgrade() -> None:
    op.drop_table("evaluator_versions")
    op.drop_table("evaluators")
