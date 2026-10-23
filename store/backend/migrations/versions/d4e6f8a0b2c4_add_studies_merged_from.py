"""add studies.merged_from

Revision ID: d4e6f8a0b2c4
Revises: c7e9a1b3d5f8
Create Date: 2026-10-23

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4e6f8a0b2c4"
down_revision = "c7e9a1b3d5f8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("studies", sa.Column("merged_from", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("studies", "merged_from")
