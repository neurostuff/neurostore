"""add base study metadata outbox

Revision ID: e3b7c9d1a2f4
Revises: d2f4a6b8c0e2
Create Date: 2026-02-11 15:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e3b7c9d1a2f4"
down_revision = "d2f4a6b8c0e2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "base_study_metadata_outbox",
        sa.Column("base_study_id", sa.Text(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column(
            "enqueued_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["base_study_id"], ["base_studies.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("base_study_id"),
    )
    op.create_index(
        op.f("ix_base_study_metadata_outbox_enqueued_at"),
        "base_study_metadata_outbox",
        ["enqueued_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_base_study_metadata_outbox_updated_at"),
        "base_study_metadata_outbox",
        ["updated_at"],
        unique=False,
    )
    op.create_index(
        "ix_base_study_metadata_outbox_updated_at_base_study_id",
        "base_study_metadata_outbox",
        ["updated_at", "base_study_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_base_study_metadata_outbox_updated_at_base_study_id",
        table_name="base_study_metadata_outbox",
    )
    op.drop_index(
        op.f("ix_base_study_metadata_outbox_updated_at"),
        table_name="base_study_metadata_outbox",
    )
    op.drop_index(
        op.f("ix_base_study_metadata_outbox_enqueued_at"),
        table_name="base_study_metadata_outbox",
    )
    op.drop_table("base_study_metadata_outbox")
