"""add analysis source_id column for clone lineage

Revision ID: b1c2d3e4f5a6
Revises: a6d7e8f9a0b1
Create Date: 2026-08-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "a6d7e8f9a0b1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("analyses", sa.Column("source_id", sa.String(), nullable=True))
    op.create_index(
        op.f("ix_analyses_source_id"), "analyses", ["source_id"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_analyses_source_id"), table_name="analyses")
    op.drop_column("analyses", "source_id")
