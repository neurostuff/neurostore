"""index base_studies.fulltext_id

A migration of its own because the index builds CONCURRENTLY on an existing table.

Revision ID: d4b7e1f9a3c2
Revises: c5d8e2f4a6b1
Create Date: 2026-10-16

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "d4b7e1f9a3c2"
down_revision = "c5d8e2f4a6b1"
branch_labels = None
depends_on = None


def upgrade():
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_base_studies_fulltext_id "
            "ON base_studies (fulltext_id)"
        )


def downgrade():
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_base_studies_fulltext_id")
