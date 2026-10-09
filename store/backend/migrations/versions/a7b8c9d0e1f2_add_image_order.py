"""add image order column

Revision ID: a7b8c9d0e1f2
Revises: c9e1a3f5b7d9
Create Date: 2026-08-20 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a7b8c9d0e1f2"
down_revision = "c9e1a3f5b7d9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("images", sa.Column("order", sa.Integer(), nullable=True))

    # Backfill so already-stored images have a stable display order: images
    # numbered within their analysis (or within their study, for the
    # "uncategorized" images that have no analysis), oldest first.
    op.execute(
        """
        UPDATE images AS i
        SET "order" = numbered.row_number
        FROM (
            SELECT
                id,
                row_number() OVER (
                    PARTITION BY analysis_id, study_id
                    ORDER BY add_date NULLS LAST, created_at NULLS LAST, id
                ) AS row_number
            FROM images
        ) AS numbered
        WHERE i.id = numbered.id
        """
    )


def downgrade():
    op.drop_column("images", "order")
