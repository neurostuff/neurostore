"""drop study_entity_aliases

Revision ID: a7d3e9c1b5f2
Revises: f1a3c5e7b9d2
Create Date: 2026-10-12 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a7d3e9c1b5f2"
down_revision = "f1a3c5e7b9d2"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index("ix_study_entity_aliases_entity_id", table_name="study_entity_aliases")
    op.drop_table("study_entity_aliases")


def downgrade():
    op.create_table(
        "study_entity_aliases",
        sa.Column("entity_hash", sa.String(64), nullable=False),
        sa.Column("entity_id", sa.Text(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("config_id", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["entity_id"], ["study_entities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["config_id"], ["pipeline_configs.id"]),
        sa.PrimaryKeyConstraint("entity_hash"),
    )
    op.create_index(
        "ix_study_entity_aliases_entity_id", "study_entity_aliases", ["entity_id"]
    )
