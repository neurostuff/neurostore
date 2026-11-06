"""analysis_features: diagnosis_* columns are medical_condition_*

Revision ID: e1f3a5c7b9d2
Revises: c3e5a7b9d1f2
Create Date: 2026-11-06

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "e1f3a5c7b9d2"
down_revision = "c3e5a7b9d1f2"
branch_labels = None
depends_on = None

COLUMNS = ("ids", "labels", "text")
INDEXES = ("ids", "text_trgm")


def _rename(old, new):
    for suffix in COLUMNS:
        op.alter_column("analysis_features", f"{old}_{suffix}", new_column_name=f"{new}_{suffix}")
    for suffix in INDEXES:
        op.execute(
            f"ALTER INDEX ix_analysis_features__{old}_{suffix}"
            f" RENAME TO ix_analysis_features__{new}_{suffix}"
        )
    op.execute(
        f"UPDATE analysis_feature_displays"
        f" SET display = display - '{old}' || jsonb_build_object('{new}', display -> '{old}')"
        f" WHERE display ? '{old}'"
    )


def upgrade():
    _rename("diagnosis", "medical_condition")


def downgrade():
    _rename("medical_condition", "diagnosis")
