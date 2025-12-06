"""add curation_stub_uuid to studyset_studies

Revision ID: 8e3f3d8a9b5b
Revises: 1473078c723e
Create Date: 2025-10-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8e3f3d8a9b5b"
down_revision = "1473078c723e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "studyset_studies",
        sa.Column("curation_stub_uuid", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_studyset_studies_curation_stub_uuid",
        "studyset_studies",
        ["curation_stub_uuid"],
        unique=False,
    )
    op.create_unique_constraint(
        "uq_studyset_stub_uuid",
        "studyset_studies",
        ["studyset_id", "curation_stub_uuid"],
    )


def downgrade():
    op.drop_constraint("uq_studyset_stub_uuid", "studyset_studies", type_="unique")
    op.drop_index("ix_studyset_studies_curation_stub_uuid", table_name="studyset_studies")
    op.drop_column("studyset_studies", "curation_stub_uuid")
