"""add analysis outcome, role, from_prior_study and base study retraction

Revision ID: f1a3c5e7b9d2
Revises: 28cdbfce7bfa
Create Date: 2026-10-09 22:00:00.000000

Ordered after #1768's head (28cdbfce7bfa). On master, #1822's e7a9c1d3f5b7 follows
d5f7a9b1c3e5; when #1768 is rebased onto master its revision is re-pointed after that,
and this one stays after #1768's.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "f1a3c5e7b9d2"
down_revision = "28cdbfce7bfa"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("analyses", sa.Column("outcome", sa.String(), nullable=True))
    op.add_column("analyses", sa.Column("role", sa.String(), nullable=True))
    op.add_column("analyses", sa.Column("from_prior_study", sa.Boolean(), nullable=True))
    op.create_index("ix_analyses_outcome", "analyses", ["outcome"])
    op.create_index("ix_analyses_role", "analyses", ["role"])
    op.add_column("base_studies", sa.Column("is_retracted", sa.Boolean(), nullable=True))
    op.add_column(
        "base_studies",
        sa.Column("retraction_notice", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_base_studies_is_retracted", "base_studies", ["is_retracted"])


def downgrade():
    op.drop_index("ix_base_studies_is_retracted", table_name="base_studies")
    op.drop_column("base_studies", "retraction_notice")
    op.drop_column("base_studies", "is_retracted")
    op.drop_index("ix_analyses_role", table_name="analyses")
    op.drop_index("ix_analyses_outcome", table_name="analyses")
    op.drop_column("analyses", "from_prior_study")
    op.drop_column("analyses", "role")
    op.drop_column("analyses", "outcome")
