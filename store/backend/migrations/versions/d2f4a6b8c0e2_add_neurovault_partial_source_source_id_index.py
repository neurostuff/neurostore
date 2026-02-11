"""add neurovault partial source/source_id index

Revision ID: d2f4a6b8c0e2
Revises: c1e2f3a4b5c6
Create Date: 2026-02-09 16:40:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d2f4a6b8c0e2"
down_revision = "c1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "ix_studies_source_source_id_neurovault",
        "studies",
        ["source", "source_id"],
        unique=False,
        postgresql_where=sa.text("source = 'neurovault'"),
    )


def downgrade():
    op.drop_index("ix_studies_source_source_id_neurovault", table_name="studies")
