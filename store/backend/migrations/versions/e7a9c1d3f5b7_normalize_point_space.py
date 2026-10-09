"""normalize points.space to MNI / TAL / OTHER / UNKNOWN

Rewrites existing values with the same normalize_space the Point.space
validator applies on write, so legacy spellings such as 'Talairach' are TAL
before a frontend save would turn them into OTHER. Blank becomes NULL.

Revision ID: e7a9c1d3f5b7
Revises: d5f7a9b1c3e5
Create Date: 2026-10-09 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

from neurostore.coordinate_spaces import normalize_space


# revision identifiers, used by Alembic.
revision = "e7a9c1d3f5b7"
down_revision = "d5f7a9b1c3e5"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    spaces = bind.execute(
        sa.text("SELECT DISTINCT space FROM points WHERE space IS NOT NULL")
    ).scalars()
    for old in list(spaces):
        new = normalize_space(old)
        if new != old:
            bind.execute(
                sa.text("UPDATE points SET space = :new WHERE space = :old"),
                {"new": new, "old": old},
            )


def downgrade():
    # The original spellings are not kept, so there is nothing to restore.
    pass
