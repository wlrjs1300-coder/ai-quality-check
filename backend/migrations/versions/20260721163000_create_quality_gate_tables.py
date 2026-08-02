"""Create quality gate policy and result tables."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260721163000"
down_revision = "20260721160000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quality_gate_policies",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "project_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("minimum_pass_rate", sa.Numeric(5, 4), nullable=False),
        sa.Column("block_on_error", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "block_on_required_case_failure",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("project_id", "name", name="uq_quality_gate_policies_project_name"),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_quality_gate_policies_name_not_blank"),
        sa.CheckConstraint(
            "minimum_pass_rate >= 0 AND minimum_pass_rate <= 1",
            name="ck_quality_gate_policies_minimum_pass_rate",
        ),
    )

    op.create_table(
        "quality_gate_results",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "policy_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("quality_gate_policies.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "experiment_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("experiments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("pass_rate", sa.Numeric(5, 4), nullable=False),
        sa.Column("total_case_count", sa.Integer(), nullable=False),
        sa.Column("passed_case_count", sa.Integer(), nullable=False),
        sa.Column("failed_case_count", sa.Integer(), nullable=False),
        sa.Column("error_case_count", sa.Integer(), nullable=False),
        sa.Column("required_case_failure_count", sa.Integer(), nullable=False),
        sa.Column(
            "reason_codes",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("reason_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("policy_id", "experiment_id", name="uq_quality_gate_results_policy_experiment"),
        sa.CheckConstraint("status IN ('PASS', 'BLOCK')", name="ck_quality_gate_results_status"),
        sa.CheckConstraint("pass_rate >= 0 AND pass_rate <= 1", name="ck_quality_gate_results_pass_rate"),
        sa.CheckConstraint("total_case_count >= 0", name="ck_quality_gate_results_total_count"),
        sa.CheckConstraint("passed_case_count >= 0", name="ck_quality_gate_results_passed_count"),
        sa.CheckConstraint("failed_case_count >= 0", name="ck_quality_gate_results_failed_count"),
        sa.CheckConstraint("error_case_count >= 0", name="ck_quality_gate_results_error_count"),
        sa.CheckConstraint(
            "required_case_failure_count >= 0",
            name="ck_quality_gate_results_required_failure_count",
        ),
        sa.CheckConstraint(
            "passed_case_count + failed_case_count + error_case_count = total_case_count",
            name="ck_quality_gate_results_count_consistency",
        ),
    )


def downgrade() -> None:
    op.drop_table("quality_gate_results")
    op.drop_table("quality_gate_policies")
