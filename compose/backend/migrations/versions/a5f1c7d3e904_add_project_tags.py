"""add project tags

Revision ID: a5f1c7d3e904
Revises: d7e8f9a0b1c2
Create Date: 2026-09-11 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a5f1c7d3e904"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("project_tags"):
        op.create_table(
            "project_tags",
            sa.Column("project_id", sa.Text(), nullable=False),
            sa.Column("tag_id", sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
            sa.ForeignKeyConstraint(["tag_id"], ["tags.id"]),
            sa.PrimaryKeyConstraint("project_id", "tag_id"),
        )
        op.create_index("ix_project_tags_tag_id", "project_tags", ["tag_id"])


def downgrade():
    op.drop_index("ix_project_tags_tag_id", table_name="project_tags")
    op.drop_table("project_tags")
