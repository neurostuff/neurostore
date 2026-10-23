"""add authors, universities and each paper's authors and affiliations

Revision ID: e7a9c1d3f5b8
Revises: d4e6f8a0b2c4
Create Date: 2026-10-23

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e7a9c1d3f5b8"
down_revision = "d4e6f8a0b2c4"
branch_labels = None
depends_on = None


def _base(name, *columns, constraints=()):
    op.create_table(
        name,
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        *columns,
        sa.PrimaryKeyConstraint("id"),
        *constraints,
    )
    for column in ("id", "created_at", "updated_at"):
        op.create_index(op.f(f"ix_{name}_{column}"), name, [column], unique=False)


def upgrade():
    _base(
        "authors",
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("orcid", sa.Text(), nullable=True),
        sa.Column("openalex_id", sa.Text(), nullable=True),
        constraints=(
            sa.UniqueConstraint("orcid", name="uq_authors_orcid"),
            sa.UniqueConstraint("openalex_id", name="uq_authors_openalex_id"),
        ),
    )
    _base(
        "universities",
        sa.Column("ror", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("country", sa.Text(), nullable=True),
        constraints=(sa.UniqueConstraint("ror", name="uq_universities_ror"),),
    )
    _base(
        "base_study_authors",
        sa.Column("base_study_id", sa.Text(), nullable=False),
        sa.Column("author_id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("corresponding", sa.Boolean(), nullable=True),
        constraints=(
            sa.ForeignKeyConstraint(["base_study_id"], ["base_studies.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["author_id"], ["authors.id"], ondelete="CASCADE"),
            sa.UniqueConstraint(
                "base_study_id", "position", name="uq_base_study_authors_base_study_id_position"
            ),
        ),
    )
    for column in ("base_study_id", "author_id"):
        op.create_index(
            op.f(f"ix_base_study_authors_{column}"), "base_study_authors", [column], unique=False
        )
    _base(
        "base_study_author_affiliations",
        sa.Column("base_study_author_id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("university_id", sa.Text(), nullable=True),
        constraints=(
            sa.ForeignKeyConstraint(
                ["base_study_author_id"], ["base_study_authors.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["university_id"], ["universities.id"], ondelete="SET NULL"),
        ),
    )
    for column in ("base_study_author_id", "university_id"):
        op.create_index(
            op.f(f"ix_base_study_author_affiliations_{column}"),
            "base_study_author_affiliations",
            [column],
            unique=False,
        )
    op.add_column(
        "corresponding_author_emails",
        sa.Column("base_study_author_id", sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        "fk_corresponding_author_emails_base_study_author_id",
        "corresponding_author_emails",
        "base_study_authors",
        ["base_study_author_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_corresponding_author_emails_base_study_author_id"),
        "corresponding_author_emails",
        ["base_study_author_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        op.f("ix_corresponding_author_emails_base_study_author_id"),
        table_name="corresponding_author_emails",
    )
    op.drop_constraint(
        "fk_corresponding_author_emails_base_study_author_id",
        "corresponding_author_emails",
        type_="foreignkey",
    )
    op.drop_column("corresponding_author_emails", "base_study_author_id")
    op.drop_table("base_study_author_affiliations")
    op.drop_table("base_study_authors")
    op.drop_table("universities")
    op.drop_table("authors")
