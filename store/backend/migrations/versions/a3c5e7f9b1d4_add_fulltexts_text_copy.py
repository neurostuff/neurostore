"""add fulltexts.text_copy

Revision ID: a3c5e7f9b1d4
Revises: f2b4d6e8a0c3
Create Date: 2026-10-17

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = "a3c5e7f9b1d4"
down_revision = "f2b4d6e8a0c3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("fulltexts", sa.Column("text_copy", JSONB(), nullable=True))


def downgrade():
    op.drop_column("fulltexts", "text_copy")
