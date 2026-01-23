"""add table_label to tables

Revision ID: d4c5a604ecc2
Revises: a1b2c3d4e5f6
Create Date: 2026-01-21 19:17:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4c5a604ecc2"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tables", sa.Column("table_label", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("tables", "table_label")
