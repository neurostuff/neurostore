"""add type to projects

Revision ID: d7e8f9a0b1c2
Revises: 5f0b9c4a1d7e
Create Date: 2026-07-29 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "d7e8f9a0b1c2"
down_revision = "5f0b9c4a1d7e"
branch_labels = None
depends_on = None


def upgrade():
    project_type = postgresql.ENUM("CBMA", "IBMA", name="project_type")
    project_type.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "projects",
        sa.Column(
            "type",
            project_type,
            nullable=False,
            server_default=sa.text("'CBMA'"),
        ),
    )
    op.alter_column("projects", "type", server_default=None)


def downgrade():
    op.drop_column("projects", "type")
    project_type = postgresql.ENUM("CBMA", "IBMA", name="project_type")
    project_type.drop(op.get_bind(), checkfirst=True)
