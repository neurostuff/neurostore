"""add study_entities.stable_id

The backfill is one UPDATE inside alembic's single transaction, which holds a lock on
study_entities until the upgrade commits. That is brief while the table is small; run the
upgrade of a large study_entities table in a maintenance window.

Revision ID: f2b4d6e8a0c3
Revises: d4b7e1f9a3c2
Create Date: 2026-10-16

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f2b4d6e8a0c3"
down_revision = "d4b7e1f9a3c2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("study_entities", sa.Column("stable_id", sa.Text(), nullable=True))
    op.execute("UPDATE study_entities SET stable_id = gen_random_uuid()::text")
    op.alter_column("study_entities", "stable_id", nullable=False)
    op.create_unique_constraint(
        "uq_study_entity__stable_id", "study_entities", ["stable_id"]
    )


def downgrade():
    op.drop_constraint("uq_study_entity__stable_id", "study_entities", type_="unique")
    op.drop_column("study_entities", "stable_id")
