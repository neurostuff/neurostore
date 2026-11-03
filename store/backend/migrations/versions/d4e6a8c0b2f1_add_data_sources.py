"""add data_sources

Revision ID: d4e6a8c0b2f1
Revises: b3d5f7a9c1e4
Create Date: 2026-11-03

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "d4e6a8c0b2f1"
down_revision = "b3d5f7a9c1e4"
branch_labels = None
depends_on = None


def _text_array(name):
    return sa.Column(
        name,
        postgresql.ARRAY(sa.Text()),
        server_default="{}",
        nullable=False,
    )


def upgrade():
    op.create_table(
        "data_sources",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        _text_array("kinds"),
        _text_array("modalities"),
        sa.Column("part_of_id", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("url_kind", sa.Text(), nullable=True),
        _text_array("rrids"),
        _text_array("re3data_ids"),
        _text_array("listed_in"),
        sa.Column("user_id", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["part_of_id"], ["data_sources.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.external_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    for column in ("id", "created_at", "updated_at", "part_of_id", "user_id"):
        op.create_index(
            op.f(f"ix_data_sources_{column}"), "data_sources", [column], unique=False
        )

    op.create_table(
        "data_source_aliases",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("data_source_id", sa.Text(), nullable=False),
        sa.Column("alias", sa.Text(), nullable=False),
        sa.Column("tier", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["data_source_id"], ["data_sources.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.external_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "data_source_id", "alias", "tier", name="uq_data_source_aliases"
        ),
    )
    for column in ("id", "created_at", "updated_at", "data_source_id", "user_id"):
        op.create_index(
            op.f(f"ix_data_source_aliases_{column}"),
            "data_source_aliases",
            [column],
            unique=False,
        )

    op.create_table(
        "analysis_data_sources",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("analysis_id", sa.Text(), nullable=False),
        sa.Column("data_source_id", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["data_source_id"], ["data_sources.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("analysis_id", "data_source_id"),
    )
    for column in ("analysis_id", "data_source_id"):
        op.create_index(
            op.f(f"ix_analysis_data_sources_{column}"),
            "analysis_data_sources",
            [column],
            unique=False,
        )

    for table, owner, owner_table in (
        ("study_data_sources", "study_id", "studies"),
        ("base_study_data_sources", "base_study_id", "base_studies"),
    ):
        op.create_table(
            table,
            sa.Column(owner, sa.Text(), nullable=False),
            sa.Column("data_source_id", sa.Text(), nullable=False),
            sa.ForeignKeyConstraint([owner], [f"{owner_table}.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["data_source_id"], ["data_sources.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint(owner, "data_source_id"),
        )
        op.create_index(
            op.f(f"ix_{table}_data_source_id"), table, ["data_source_id"], unique=False
        )


def downgrade():
    op.drop_table("base_study_data_sources")
    op.drop_table("study_data_sources")
    op.drop_table("analysis_data_sources")
    op.drop_table("data_source_aliases")
    op.drop_table("data_sources")
