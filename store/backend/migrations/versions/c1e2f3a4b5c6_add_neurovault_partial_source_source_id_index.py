"""add neurovault partial source/source_id index

Revision ID: c1e2f3a4b5c6
Revises: b7c8d9e0f1a2
Create Date: 2026-02-09 16:40:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c1e2f3a4b5c6"
down_revision = "b7c8d9e0f1a2"
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
