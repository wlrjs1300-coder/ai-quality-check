"""Create experiment and evaluation result tables."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260721160000"
down_revision = "20260721153000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "experiments",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "dataset_version_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("dataset_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "target_version_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("target_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "evaluator_version_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("evaluator_versions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=16), nullable=False, server_default=sa.text("'CREATED'")),
        sa.Column("total_cases", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("pass_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("fail_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("error_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("total_cases >= 0"),
        sa.CheckConstraint("pass_count >= 0"),
        sa.CheckConstraint("fail_count >= 0"),
        sa.CheckConstraint("error_count >= 0"),
        sa.CheckConstraint("status IN ('CREATED', 'RUNNING', 'COMPLETED', 'FAILED')"),
    )

    op.create_table(
        "evaluation_results",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "experiment_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("experiments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "dataset_version_case_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("dataset_version_cases.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "input_snapshot",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "output_snapshot",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("reason_code", sa.String(length=80), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint(
            "experiment_id",
            "dataset_version_case_id",
            name="uq_evaluation_results_experiment_case",
        ),
        sa.CheckConstraint("status IN ('PASS', 'FAIL', 'ERROR')"),
    )


def downgrade() -> None:
    op.drop_table("evaluation_results")
    op.drop_table("experiments")
