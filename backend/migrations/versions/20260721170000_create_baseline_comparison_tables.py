"""Create baseline comparison tables."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260721170000"
down_revision = "20260721163000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "baseline_comparisons",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("project_id", sa.Uuid(as_uuid=True), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
        sa.Column(
            "baseline_experiment_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("experiments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "current_experiment_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("experiments.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("total_case_count", sa.Integer(), nullable=False),
        sa.Column("improved_case_count", sa.Integer(), nullable=False),
        sa.Column("unchanged_case_count", sa.Integer(), nullable=False),
        sa.Column("regressed_case_count", sa.Integer(), nullable=False),
        sa.Column("baseline_passed_case_count", sa.Integer(), nullable=False),
        sa.Column("current_passed_case_count", sa.Integer(), nullable=False),
        sa.Column("pass_rate_delta", sa.Numeric(6, 4), nullable=False),
        sa.Column(
            "reason_codes",
            sa.JSON().with_variant(postgresql.JSONB(), "postgresql"),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
        sa.Column("reason_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint(
            "baseline_experiment_id",
            "current_experiment_id",
            name="uq_baseline_comparisons_experiment_pair",
        ),
        sa.CheckConstraint("baseline_experiment_id <> current_experiment_id", name="ck_baseline_comparisons_distinct"),
        sa.CheckConstraint("status IN ('IMPROVED', 'UNCHANGED', 'REGRESSED')", name="ck_baseline_comparisons_status"),
        sa.CheckConstraint("total_case_count > 0", name="ck_baseline_comparisons_total_count"),
        sa.CheckConstraint("improved_case_count >= 0", name="ck_baseline_comparisons_improved_count"),
        sa.CheckConstraint("unchanged_case_count >= 0", name="ck_baseline_comparisons_unchanged_count"),
        sa.CheckConstraint("regressed_case_count >= 0", name="ck_baseline_comparisons_regressed_count"),
        sa.CheckConstraint("baseline_passed_case_count >= 0", name="ck_baseline_comparisons_baseline_passed_count"),
        sa.CheckConstraint("current_passed_case_count >= 0", name="ck_baseline_comparisons_current_passed_count"),
        sa.CheckConstraint(
            "improved_case_count + unchanged_case_count + regressed_case_count = total_case_count",
            name="ck_baseline_comparisons_count_consistency",
        ),
        sa.CheckConstraint(
            "pass_rate_delta >= -1 AND pass_rate_delta <= 1",
            name="ck_baseline_comparisons_pass_rate_delta",
        ),
    )
    op.create_table(
        "baseline_comparison_cases",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "comparison_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("baseline_comparisons.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "dataset_version_case_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("dataset_version_cases.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("case_key", sa.String(length=120), nullable=False),
        sa.Column("baseline_status", sa.String(length=16), nullable=False),
        sa.Column("current_status", sa.String(length=16), nullable=False),
        sa.Column("change_status", sa.String(length=16), nullable=False),
        sa.Column("reason_code", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint(
            "comparison_id",
            "dataset_version_case_id",
            name="uq_baseline_comparison_cases_comparison_case",
        ),
        sa.CheckConstraint(
            "baseline_status IN ('PASS', 'FAIL', 'ERROR')",
            name="ck_baseline_comparison_cases_baseline_status",
        ),
        sa.CheckConstraint(
            "current_status IN ('PASS', 'FAIL', 'ERROR')",
            name="ck_baseline_comparison_cases_current_status",
        ),
        sa.CheckConstraint(
            "change_status IN ('IMPROVED', 'UNCHANGED', 'REGRESSED')",
            name="ck_baseline_comparison_cases_change_status",
        ),
    )


def downgrade() -> None:
    op.drop_table("baseline_comparison_cases")
    op.drop_table("baseline_comparisons")
