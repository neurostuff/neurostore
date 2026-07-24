"""add is_active and superseded_by to base_studies

Revision ID: a1b2c3d4e5f6
Revises: 8e3f3d8a9b5b
Create Date: 2026-01-21 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "8e3f3d8a9b5b"
branch_labels = None
depends_on = None


def upgrade():
    # Add is_active column with default True
    op.add_column(
        "base_studies",
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
    )
    # Create index on is_active for better query performance
    op.create_index(
        op.f("ix_base_studies_is_active"), "base_studies", ["is_active"], unique=False
    )

    # Add superseded_by column (nullable self-referencing foreign key)
    op.add_column(
        "base_studies",
        sa.Column("superseded_by", sa.Text(), nullable=True),
    )
    # Create foreign key constraint
    op.create_foreign_key(
        "fk_base_studies_superseded_by",
        "base_studies",
        "base_studies",
        ["superseded_by"],
        ["id"],
        ondelete="SET NULL",
    )

    # Add check constraint to prevent self-reference
    op.create_check_constraint(
        "no_self_reference",
        "base_studies",
        "id != superseded_by",
    )


def downgrade():
    # Drop check constraint
    op.drop_constraint("no_self_reference", "base_studies", type_="check")

    # Drop foreign key constraint
    op.drop_constraint(
        "fk_base_studies_superseded_by", "base_studies", type_="foreignkey"
    )

    # Drop superseded_by column
    op.drop_column("base_studies", "superseded_by")

    # Drop is_active index
    op.drop_index(op.f("ix_base_studies_is_active"), table_name="base_studies")

    # Drop is_active column
    op.drop_column("base_studies", "is_active")
