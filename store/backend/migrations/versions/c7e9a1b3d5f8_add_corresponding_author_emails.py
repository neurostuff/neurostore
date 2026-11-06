"""add corresponding_author_emails

Revision ID: c7e9a1b3d5f8
Revises: a3c5e7f9b1d4
Create Date: 2026-10-22

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c7e9a1b3d5f8"
down_revision = "a3c5e7f9b1d4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "corresponding_author_emails",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("base_study_id", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("email_index", sa.Text(), nullable=False),
        sa.Column("contacted", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("responded", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("shared", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(["base_study_id"], ["base_studies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "base_study_id",
            "email_index",
            name="uq_corresponding_author_emails_base_study_id_email_index",
        ),
    )
    for column in ("id", "created_at", "updated_at", "base_study_id"):
        op.create_index(
            op.f(f"ix_corresponding_author_emails_{column}"),
            "corresponding_author_emails",
            [column],
            unique=False,
        )


def downgrade():
    op.drop_table("corresponding_author_emails")
