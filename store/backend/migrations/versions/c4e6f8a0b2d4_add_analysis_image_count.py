"""add analysis image_count column

Revision ID: c4e6f8a0b2d4
Revises: b3d5e7f9a1c4
Create Date: 2026-09-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c4e6f8a0b2d4"
down_revision = "b3d5e7f9a1c4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "analyses",
        sa.Column(
            "image_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    # Backfill once from existing images.
    op.execute(
        """
        UPDATE analyses AS a
        SET image_count = COALESCE(i.image_count, 0)
        FROM (
            SELECT analysis_id, COUNT(*)::integer AS image_count
            FROM images
            WHERE analysis_id IS NOT NULL
            GROUP BY analysis_id
        ) AS i
        WHERE a.id = i.analysis_id
        """
    )


def downgrade():
    op.drop_column("analyses", "image_count")
