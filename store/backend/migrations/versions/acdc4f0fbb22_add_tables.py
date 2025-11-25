"""add tables model and link analyses

Revision ID: acdc4f0fbb22
Revises: 9f072fcaec39
Create Date: 2025-02-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlalchemy_utils  # noqa: F401
import neurostore.models.migration_types  # noqa: F401


# revision identifiers, used by Alembic.
revision = "acdc4f0fbb22"
down_revision = "9f072fcaec39"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "tables",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("study_id", sa.Text(), nullable=True),
        sa.Column("t_id", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("footer", sa.Text(), nullable=True),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("user_id", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["study_id"], ["studies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.external_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("study_id", "t_id", name="uq_tables_study_t_id"),
    )
    op.create_index(op.f("ix_tables_study_id"), "tables", ["study_id"], unique=False)
    op.create_index(op.f("ix_tables_user_id"), "tables", ["user_id"], unique=False)

    with op.batch_alter_table("analyses", schema=None) as batch_op:
        batch_op.execute(sa.text("UPDATE analyses SET table_id = NULL"))
        batch_op.create_index(op.f("ix_analyses_table_id"), ["table_id"], unique=False)
        batch_op.create_foreign_key(
            "fk_analyses_table_id_tables",
            "tables",
            ["table_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade():
    with op.batch_alter_table("analyses", schema=None) as batch_op:
        batch_op.drop_constraint("fk_analyses_table_id_tables", type_="foreignkey")
        batch_op.drop_index(op.f("ix_analyses_table_id"))

    op.drop_index(op.f("ix_tables_user_id"), table_name="tables")
    op.drop_index(op.f("ix_tables_study_id"), table_name="tables")
    op.drop_table("tables")
