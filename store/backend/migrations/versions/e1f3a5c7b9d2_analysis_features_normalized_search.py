"""analysis_features: medical_condition_* columns; ancestors, unmapped flags, contrast keys,
roles and the analysis name for search by normalized terms; analysis_terms

Revision ID: e1f3a5c7b9d2
Revises: c3e5a7b9d1f2
Create Date: 2026-11-06

Existing rows keep their medical-condition and task ids as their ancestors, with unmapped
flags read from their ids and text; contrast keys, directional sets, roles, names and terms
need `manage backfill-analysis-features`.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e1f3a5c7b9d2"
down_revision = "c3e5a7b9d1f2"
branch_labels = None
depends_on = None

TABLE = "analysis_features"
TEXT_ARRAY = postgresql.ARRAY(sa.Text())
ARRAYS = (
    "medical_condition_ancestor_ids",
    "medical_condition_role_ids",
    "medical_condition_role_ancestor_ids",
    "task_ancestor_ids",
    "task_family_ids",
    "contrast_key_ids",
    "contrast_key_ancestor_ids",
    "contrast_set_ancestor_ids",
    "mapping_tools",
)
GIN = (
    "medical_condition_ancestor_ids",
    "medical_condition_role_ids",
    "medical_condition_role_ancestor_ids",
    "task_ancestor_ids",
    "contrast_key_ids",
    "contrast_key_ancestor_ids",
    "contrast_set_ancestor_ids",
)
UNMAPPED = ("medical_condition", "task", "contrast_key", "contrast_set")


def _trigram(column):
    op.create_index(
        f"ix_{TABLE}__{column}_trgm",
        TABLE,
        [column],
        postgresql_using="gin",
        postgresql_ops={column: "gin_trgm_ops"},
    )


def _rename(old, new):
    for suffix in ("ids", "text"):
        op.alter_column(TABLE, f"{old}_{suffix}", new_column_name=f"{new}_{suffix}")
    for suffix in ("ids", "text_trgm"):
        op.execute(f"ALTER INDEX ix_{TABLE}__{old}_{suffix} RENAME TO ix_{TABLE}__{new}_{suffix}")
    op.execute(
        f"UPDATE analysis_feature_displays"
        f" SET display = display - '{old}' || jsonb_build_object('{new}', display -> '{old}')"
        f" WHERE display ? '{old}'"
    )


def upgrade():
    _rename("diagnosis", "medical_condition")
    op.drop_column(TABLE, "diagnosis_labels")
    op.drop_index(f"ix_{TABLE}__contrast_set_text_trgm", table_name=TABLE)
    op.drop_column(TABLE, "contrast_set_text")
    for column in ARRAYS:
        op.add_column(TABLE, sa.Column(column, TEXT_ARRAY, nullable=True))
    for field in UNMAPPED:
        op.add_column(TABLE, sa.Column(f"{field}_unmapped", sa.Boolean(), nullable=True))
        op.create_index(op.f(f"ix_{TABLE}_{field}_unmapped"), TABLE, [f"{field}_unmapped"])
    op.add_column(TABLE, sa.Column("name_text", sa.Text(), nullable=True))
    for column in GIN:
        op.create_index(f"ix_{TABLE}__{column}", TABLE, [column], postgresql_using="gin")
    _trigram("name_text")
    op.execute(
        f"UPDATE {TABLE} SET"
        " medical_condition_ancestor_ids = medical_condition_ids,"
        " medical_condition_unmapped = CASE WHEN medical_condition_text IS NOT NULL"
        " OR medical_condition_ids IS NOT NULL THEN medical_condition_ids IS NULL END,"
        " task_ancestor_ids = task_ids,"
        " task_unmapped = CASE WHEN task_text IS NOT NULL OR task_ids IS NOT NULL"
        " THEN task_ids IS NULL END"
    )
    op.create_table(
        "analysis_terms",
        sa.Column("field", sa.Text(), nullable=False),
        sa.Column("term", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("parent", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("field", "term"),
    )
    op.create_index("ix_analysis_terms_field_parent", "analysis_terms", ["field", "parent"])


def downgrade():
    op.drop_table("analysis_terms")
    op.drop_index(f"ix_{TABLE}__name_text_trgm", table_name=TABLE)
    for column in GIN:
        op.drop_index(f"ix_{TABLE}__{column}", table_name=TABLE)
    op.drop_column(TABLE, "name_text")
    for field in UNMAPPED:
        op.drop_index(op.f(f"ix_{TABLE}_{field}_unmapped"), table_name=TABLE)
        op.drop_column(TABLE, f"{field}_unmapped")
    for column in ARRAYS:
        op.drop_column(TABLE, column)
    op.add_column(TABLE, sa.Column("contrast_set_text", sa.Text(), nullable=True))
    _trigram("contrast_set_text")
    op.add_column(TABLE, sa.Column("diagnosis_labels", TEXT_ARRAY, nullable=True))
    _rename("medical_condition", "diagnosis")
