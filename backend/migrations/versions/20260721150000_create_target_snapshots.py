"""Create target registry and immutable target version tables."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260721150000"
down_revision = "20260721143000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "targets",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("project_id", sa.Uuid(as_uuid=True), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("target_type", sa.String(length=16), nullable=False),
        sa.Column(
            "config",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("project_id", "name", name="uq_targets_project_name"),
        sa.CheckConstraint("length(trim(name)) > 0"),
        sa.CheckConstraint("target_type IN ('MOCK')"),
    )

    op.create_table(
        "target_versions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "target_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("targets.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "config_snapshot",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("response_strategy", sa.String(length=16), nullable=False, server_default=sa.text("'FIXED'")),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("failure_rate", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("target_id", "version", name="uq_target_versions_target_version"),
        sa.UniqueConstraint("target_id", "content_hash", name="uq_target_versions_target_content_hash"),
        sa.CheckConstraint("version >= 1"),
        sa.CheckConstraint("response_strategy IN ('FIXED', 'CASE_BASED', 'SCENARIO_BASED')"),
        sa.CheckConstraint("latency_ms >= 0"),
        sa.CheckConstraint("failure_rate >= 0 AND failure_rate <= 1"),
    )


def downgrade() -> None:
    op.drop_table("target_versions")
    op.drop_table("targets")
