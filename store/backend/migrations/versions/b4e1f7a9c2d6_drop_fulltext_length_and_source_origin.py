"""Drops fulltexts.length and review_sources.origin (derived in the models).

The downgrade restores both from the text and the pipeline columns.

Revision ID: b4e1f7a9c2d6
Revises: c5d8e2f4a6b1
Create Date: 2026-10-15

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b4e1f7a9c2d6"
down_revision = "c5d8e2f4a6b1"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("fulltexts", "length")
    op.drop_constraint("ck_review_sources_origin", "review_sources", type_="check")
    op.drop_column("review_sources", "origin")


def downgrade():
    op.add_column("fulltexts", sa.Column("length", sa.Integer(), nullable=True))
    op.execute("UPDATE fulltexts SET length = char_length(text)")
    op.alter_column("fulltexts", "length", nullable=False)

    op.add_column("review_sources", sa.Column("origin", sa.Text(), nullable=True))
    op.execute(
        """
        UPDATE review_sources
        SET origin = CASE
            WHEN pipeline_config_id IS NOT NULL AND run_id IS NOT NULL THEN 'pipeline_run'
            ELSE 'upload'
        END
        """
    )
    op.alter_column("review_sources", "origin", nullable=False)
    op.create_check_constraint(
        "ck_review_sources_origin",
        "review_sources",
        "origin IN ('upload', 'pipeline_run')",
    )
