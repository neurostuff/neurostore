"""add table_label to tables

Revision ID: d4c5a604ecc2
Revises: 8e3f3d8a9b5b
Create Date: 2026-01-21 19:17:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d4c5a604ecc2"
down_revision = "8e3f3d8a9b5b"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tables", sa.Column("table_label", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("tables", "table_label")
