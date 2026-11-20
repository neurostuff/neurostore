"""add outreach_drafts.upload_unassigned

At submit the author chooses whether maps they left unassigned to an analysis go to the
NeuroVault collection. The upload page only records the choice; whatever makes the
collection reads it. Existing drafts keep the old behaviour: every map goes.

Revision ID: c4e6a8b0d2f1
Revises: 5a7c9e1b3d6f
Create Date: 2026-11-10

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c4e6a8b0d2f1"
down_revision = "5a7c9e1b3d6f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "outreach_drafts",
        sa.Column("upload_unassigned", sa.Boolean(), server_default=sa.true(), nullable=False),
    )


def downgrade():
    op.drop_column("outreach_drafts", "upload_unassigned")
