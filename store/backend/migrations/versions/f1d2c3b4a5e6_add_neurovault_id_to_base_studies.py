"""add neurovault_id to base_studies

Revision ID: f1d2c3b4a5e6
Revises: b7c8d9e0f1a2
Create Date: 2026-02-09 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f1d2c3b4a5e6"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "base_studies",
        sa.Column("neurovault_id", sa.String(), nullable=True),
    )
    op.create_index(
        op.f("ix_base_studies_neurovault_id"),
        "base_studies",
        ["neurovault_id"],
        unique=False,
    )
    op.drop_constraint("doi_pmid", "base_studies", type_="unique")
    op.create_unique_constraint(
        "doi_pmid_neurovault_id",
        "base_studies",
        ["doi", "pmid", "neurovault_id"],
    )


def downgrade():
    op.drop_constraint(
        "doi_pmid_neurovault_id",
        "base_studies",
        type_="unique",
    )
    op.create_unique_constraint("doi_pmid", "base_studies", ["doi", "pmid"])
    op.drop_index(op.f("ix_base_studies_neurovault_id"), table_name="base_studies")
    op.drop_column("base_studies", "neurovault_id")
