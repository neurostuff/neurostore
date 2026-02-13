"""add public column to meta_analyses

Revision ID: b4a1e6b9f2c1
Revises: c8d9e0f1a2b3
Create Date: 2026-02-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b4a1e6b9f2c1"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "meta_analyses",
        sa.Column("public", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    # Backfill from owning project visibility where project linkage exists.
    op.execute(
        sa.text(
            """
            UPDATE meta_analyses AS ma
            SET public = p.public
            FROM projects AS p
            WHERE ma.project_id = p.id
            """
        )
    )
    op.create_index(
        op.f("ix_meta_analyses_public"), "meta_analyses", ["public"], unique=False
    )
    op.alter_column("meta_analyses", "public", server_default=None)


def downgrade():
    op.drop_index(op.f("ix_meta_analyses_public"), table_name="meta_analyses")
    op.drop_column("meta_analyses", "public")
