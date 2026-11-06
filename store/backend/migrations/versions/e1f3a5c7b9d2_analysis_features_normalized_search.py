"""analysis_features: medical_condition_* columns, and ancestors and unmapped flags for
search by normalized terms

Revision ID: e1f3a5c7b9d2
Revises: c3e5a7b9d1f2
Create Date: 2026-11-06

Rows written before this migration have no ancestors or unmapped flags until
`manage backfill-analysis-features` rewrites them.
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
NORMALIZED = ("medical_condition", "task", "contrast_set")
TEXT_ARRAY = postgresql.ARRAY(sa.Text())


def _rename(old, new):
    for suffix in ("ids", "labels", "text"):
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
    for field in NORMALIZED:
        op.add_column(TABLE, sa.Column(f"{field}_ancestor_ids", TEXT_ARRAY, nullable=True))
        op.add_column(TABLE, sa.Column(f"{field}_unmapped", sa.Boolean(), nullable=True))
        op.create_index(
            f"ix_{TABLE}__{field}_ancestor_ids",
            TABLE,
            [f"{field}_ancestor_ids"],
            postgresql_using="gin",
        )
        op.create_index(op.f(f"ix_{TABLE}_{field}_unmapped"), TABLE, [f"{field}_unmapped"])
    op.drop_index(f"ix_{TABLE}__contrast_set_text_trgm", table_name=TABLE)
    op.drop_column(TABLE, "contrast_set_text")
    op.add_column(TABLE, sa.Column("contrast_set_labels", TEXT_ARRAY, nullable=True))
    op.add_column(TABLE, sa.Column("mapping_tools", TEXT_ARRAY, nullable=True))


def downgrade():
    op.drop_column(TABLE, "mapping_tools")
    op.drop_column(TABLE, "contrast_set_labels")
    op.add_column(TABLE, sa.Column("contrast_set_text", sa.Text(), nullable=True))
    op.create_index(
        f"ix_{TABLE}__contrast_set_text_trgm",
        TABLE,
        ["contrast_set_text"],
        postgresql_using="gin",
        postgresql_ops={"contrast_set_text": "gin_trgm_ops"},
    )
    for field in NORMALIZED:
        op.drop_index(op.f(f"ix_{TABLE}_{field}_unmapped"), table_name=TABLE)
        op.drop_index(f"ix_{TABLE}__{field}_ancestor_ids", table_name=TABLE)
        op.drop_column(TABLE, f"{field}_unmapped")
        op.drop_column(TABLE, f"{field}_ancestor_ids")
    _rename("medical_condition", "diagnosis")
