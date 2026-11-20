"""base_studies.modalities and modalities_source: a paper's acquisition modalities

Revision ID: a88cb14fb489
Revises: d5f7a9c1e3b6
Create Date: 2026-11-19

Loaded from ns-pond's modality export by `manage base-study-modalities load`; empty until
then.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a88cb14fb489"
down_revision = "d5f7a9c1e3b6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "base_studies",
        sa.Column(
            "modalities", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"
        ),
    )
    op.add_column("base_studies", sa.Column("modalities_source", sa.Text(), nullable=True))
    op.create_index(
        "ix_base_studies_modalities", "base_studies", ["modalities"], postgresql_using="gin"
    )


def downgrade():
    op.drop_index("ix_base_studies_modalities", table_name="base_studies")
    op.drop_column("base_studies", "modalities_source")
    op.drop_column("base_studies", "modalities")
