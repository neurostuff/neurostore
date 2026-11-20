"""add journals

Revision ID: a7c9e1f3b5d2
Revises: a7c9e1b3d5f6
Create Date: 2026-11-05

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a7c9e1f3b5d2"
down_revision = "a7c9e1b3d5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "journals",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("openalex_id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("abbreviation", sa.Text(), nullable=True),
        sa.Column(
            "issns", postgresql.ARRAY(sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column("issn_l", sa.Text(), nullable=True),
        sa.Column("nlm_id", sa.Text(), nullable=True),
        sa.Column("wikidata_id", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "kind IN ('journal', 'repository', 'conference', 'book series', "
            "'ebook platform', 'other')",
            name="ck_journals_kind",
        ),
        sa.CheckConstraint(
            "issn_l IS NULL OR issn_l = ANY(issns)", name="ck_journals_issn_l"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("openalex_id"),
        sa.UniqueConstraint("issn_l"),
    )
    for column in ("id", "created_at", "updated_at"):
        op.create_index(op.f(f"ix_journals_{column}"), "journals", [column], unique=False)
    op.create_index(
        "ix_journals_issns", "journals", ["issns"], unique=False, postgresql_using="gin"
    )

    op.add_column("base_studies", sa.Column("journal_id", sa.Text(), nullable=True))
    op.add_column("base_studies", sa.Column("journal_match", sa.Text(), nullable=True))
    op.create_foreign_key(
        "base_studies_journal_id_fkey",
        "base_studies",
        "journals",
        ["journal_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_base_studies_journal_id"), "base_studies", ["journal_id"], unique=False
    )
    op.create_check_constraint(
        "ck_base_studies_journal_match",
        "base_studies",
        "journal_match IN ('doi', 'pmid', 'preprint_server', 'issn', 'title', 'fuzzy')",
    )


def downgrade():
    op.drop_constraint("ck_base_studies_journal_match", "base_studies", type_="check")
    op.drop_index(op.f("ix_base_studies_journal_id"), table_name="base_studies")
    op.drop_constraint("base_studies_journal_id_fkey", "base_studies", type_="foreignkey")
    op.drop_column("base_studies", "journal_match")
    op.drop_column("base_studies", "journal_id")
    op.drop_table("journals")
