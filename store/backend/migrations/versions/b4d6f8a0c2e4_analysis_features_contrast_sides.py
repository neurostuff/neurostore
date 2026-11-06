"""analysis_features: what each side of a contrast carries (contrast_positive_*,
contrast_negative_*)

Revision ID: b4d6f8a0c2e4
Revises: e5b7d9f1a3c4
Create Date: 2026-11-06

Existing rows are silent on the new columns until `manage backfill-analysis-features`.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "b4d6f8a0c2e4"
down_revision = "e5b7d9f1a3c4"
branch_labels = None
depends_on = None

TABLE = "analysis_features"
SIDES = ("positive", "negative")
BOOLEANS = ("has_patients", "has_healthy", "medical_condition_unmapped")
ARRAYS = (
    "medical_condition_ids",
    "medical_condition_ancestor_ids",
    "timepoints",
    "arm_kinds",
    "facets",
)
TEXT = "medical_condition_text"


def _index(column):
    """Named without `contrast_`, to fit Postgres's 63 characters."""
    return f"ix_{TABLE}__{column.removeprefix('contrast_')}"


def upgrade():
    for side in SIDES:
        prefix = f"contrast_{side}"
        for column in BOOLEANS:
            op.add_column(TABLE, sa.Column(f"{prefix}_{column}", sa.Boolean(), nullable=True))
        for column in ARRAYS:
            name = f"{prefix}_{column}"
            op.add_column(TABLE, sa.Column(name, postgresql.ARRAY(sa.Text()), nullable=True))
            op.create_index(_index(name), TABLE, [name], postgresql_using="gin")
        name = f"{prefix}_{TEXT}"
        op.add_column(TABLE, sa.Column(name, sa.Text(), nullable=True))
        op.create_index(
            f"{_index(name)}_trgm",
            TABLE,
            [name],
            postgresql_using="gin",
            postgresql_ops={name: "gin_trgm_ops"},
        )


def downgrade():
    for side in SIDES:
        prefix = f"contrast_{side}"
        op.drop_index(f"{_index(f'{prefix}_{TEXT}')}_trgm", table_name=TABLE)
        for column in ARRAYS:
            op.drop_index(_index(f"{prefix}_{column}"), table_name=TABLE)
        for column in (*BOOLEANS, *ARRAYS, TEXT):
            op.drop_column(TABLE, f"{prefix}_{column}")
