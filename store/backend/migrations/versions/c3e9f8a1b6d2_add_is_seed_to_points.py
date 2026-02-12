"""add is_seed to points

Revision ID: c3e9f8a1b6d2
Revises: b91d1f4a6a2e
Create Date: 2026-02-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c3e9f8a1b6d2"
down_revision = "b91d1f4a6a2e"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("points", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_seed",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            )
        )


def downgrade():
    with op.batch_alter_table("points", schema=None) as batch_op:
        batch_op.drop_column("is_seed")
