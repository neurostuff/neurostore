"""add analysis_features and analysis_feature_displays

Revision ID: a7c9e1b3d5f6
Revises: d4e6a8c0b2f1
Create Date: 2026-11-05

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a7c9e1b3d5f6"
down_revision = "d4e6a8c0b2f1"
branch_labels = None
depends_on = None

TEXT = (
    "spatial_scope",
    "coordinate_space",
    "measure_type",
    "measure_family",
    "effect_kind",
    "details_type",
    "diagnosis_text",
    "task_text",
    "contrast_positive",
    "contrast_negative",
    "contrast_set_text",
    "allocation",
    "assignment_structure",
    "blinding",
)
ARRAYS = (
    "species",
    "diagnosis_ids",
    "diagnosis_labels",
    "task_ids",
    "contrast_set_ids",
    "arm_kinds",
)
BTREE = (
    "study_id",
    "base_study_id",
    "config_id",
    "spatial_scope",
    "measure_type",
    "measure_family",
    "effect_kind",
    "details_type",
    "has_patients",
    "has_healthy",
    "allocation",
    "assignment_structure",
    "blinding",
    "is_meta_analysis",
)
GIN = ("diagnosis_ids", "task_ids", "contrast_set_ids", "arm_kinds", "species")
TRIGRAM = (
    "diagnosis_text",
    "task_text",
    "contrast_positive",
    "contrast_negative",
    "contrast_set_text",
)


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_table(
        "analysis_features",
        sa.Column("analysis_id", sa.Text(), nullable=False),
        sa.Column("study_id", sa.Text(), nullable=False),
        sa.Column("base_study_id", sa.Text(), nullable=False),
        sa.Column("config_id", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        *(sa.Column(name, sa.Text(), nullable=True) for name in TEXT),
        *(sa.Column(name, postgresql.ARRAY(sa.Text()), nullable=True) for name in ARRAYS),
        sa.Column("group_count", sa.Integer(), nullable=True),
        sa.Column("n", sa.Integer(), nullable=True),
        sa.Column("has_patients", sa.Boolean(), nullable=True),
        sa.Column("has_healthy", sa.Boolean(), nullable=True),
        sa.Column("longitudinal", sa.Boolean(), nullable=True),
        sa.Column("is_meta_analysis", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["study_id"], ["studies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["base_study_id"], ["base_studies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["config_id"], ["pipeline_configs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("analysis_id"),
    )
    for column in BTREE:
        op.create_index(op.f(f"ix_analysis_features_{column}"), "analysis_features", [column])
    for column in GIN:
        op.create_index(
            f"ix_analysis_features__{column}",
            "analysis_features",
            [column],
            postgresql_using="gin",
        )
    for column in TRIGRAM:
        op.create_index(
            f"ix_analysis_features__{column}_trgm",
            "analysis_features",
            [column],
            postgresql_using="gin",
            postgresql_ops={column: "gin_trgm_ops"},
        )
    op.create_table(
        "analysis_feature_displays",
        sa.Column("analysis_id", sa.Text(), nullable=False),
        sa.Column("display", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["analysis_id"], ["analysis_features.analysis_id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("analysis_id"),
    )


def downgrade():
    op.drop_table("analysis_feature_displays")
    op.drop_table("analysis_features")
