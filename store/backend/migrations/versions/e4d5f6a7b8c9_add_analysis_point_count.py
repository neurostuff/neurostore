"""add analysis point_count column

Revision ID: e4d5f6a7b8c9
Revises: d2f4a6b8c0e2
Create Date: 2026-02-11 01:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e4d5f6a7b8c9"
down_revision = "d2f4a6b8c0e2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "analyses",
        sa.Column(
            "point_count",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    # Backfill once from existing points.
    op.execute(
        """
        UPDATE analyses AS a
        SET point_count = COALESCE(p.point_count, 0)
        FROM (
            SELECT analysis_id, COUNT(*)::integer AS point_count
            FROM points
            WHERE analysis_id IS NOT NULL
            GROUP BY analysis_id
        ) AS p
        WHERE a.id = p.analysis_id
        """
    )


def downgrade():
    op.drop_column("analyses", "point_count")
