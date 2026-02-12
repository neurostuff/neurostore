"""make doi+pmid unique only for active base studies

Revision ID: b91d1f4a6a2e
Revises: e3b7c9d1a2f4
Create Date: 2026-02-12 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "b91d1f4a6a2e"
down_revision = "e3b7c9d1a2f4"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("doi_pmid", "base_studies", type_="unique")
    op.create_index(
        "uq_base_studies_doi_pmid_active",
        "base_studies",
        ["doi", "pmid"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )


def downgrade():
    op.drop_index("uq_base_studies_doi_pmid_active", table_name="base_studies")
    op.create_unique_constraint("doi_pmid", "base_studies", ["doi", "pmid"])
