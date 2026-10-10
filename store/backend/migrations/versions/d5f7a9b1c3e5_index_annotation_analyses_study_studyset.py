"""index annotation_analyses (study_id, studyset_id)

Deleting a studyset_studies row cascades through this foreign key; without an
index each deleted row scans the whole table.

Revision ID: d5f7a9b1c3e5
Revises: c4e6f8a0b2d4
Create Date: 2026-10-09 00:00:00.000000
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "d5f7a9b1c3e5"
down_revision = "c4e6f8a0b2d4"
branch_labels = None
depends_on = None


def upgrade():
    with op.get_context().autocommit_block():
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS
            ix_annotation_analyses_study_id_studyset_id
            ON annotation_analyses (study_id, studyset_id)
            """
        )


def downgrade():
    with op.get_context().autocommit_block():
        op.execute(
            """
            DROP INDEX CONCURRENTLY IF EXISTS
            ix_annotation_analyses_study_id_studyset_id
            """
        )
