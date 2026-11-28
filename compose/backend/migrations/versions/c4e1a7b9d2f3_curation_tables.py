"""move project provenance into curation tables

Creates the curation tables, fills them from each project's provenance
document (``neurosynth_compose.curation.migration``), keeps what has no table
in ``projects.provenance_extra`` and drops ``projects.provenance``. The
downgrade rebuilds ``projects.provenance`` from the tables.

Revision ID: c4e1a7b9d2f3
Revises: b8d2e6f0a4c1
Create Date: 2026-11-28 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from neurosynth_compose.curation import migration

revision = "c4e1a7b9d2f3"
down_revision = "b8d2e6f0a4c1"
branch_labels = None
depends_on = None


def _project_fk(primary_key=True):
    return sa.Column(
        "project_id",
        sa.Text(),
        sa.ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=primary_key,
        nullable=False,
    )


def _shape():
    return (
        sa.Column("extra", postgresql.JSONB()),
        sa.Column("missing", postgresql.ARRAY(sa.Text())),
    )


def upgrade():
    op.create_table(
        "curation_citations",
        sa.Column("neurostore_id", sa.Text(), primary_key=True),
        *(
            sa.Column(name, sa.Text())
            for name in ("title", "authors", "abstract", "journal", "year", "doi", "pmid", "pmcid")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "curation_columns",
        _project_fk(),
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text()),
        *_shape(),
    )
    op.create_table(
        "curation_stubs",
        sa.Column("pk", sa.BigInteger(), sa.Identity(), primary_key=True),
        _project_fk(primary_key=False),
        sa.Column("column_id", sa.Text(), nullable=False),
        sa.Column("position", sa.Float(), nullable=False),
        sa.Column("id", sa.Text()),
        sa.Column(
            "neurostore_id", sa.Text(), sa.ForeignKey("curation_citations.neurostore_id")
        ),
        *(
            sa.Column(name, sa.Text())
            for name in (
                "title",
                "authors",
                "abstract",
                "journal",
                "year",
                "doi",
                "pmid",
                "pmcid",
                "keywords",
                "article_link",
                "exclusion_tag_id",
                "identification_source_id",
                "import_id",
                "search_term",
            )
        ),
        *_shape(),
        sa.Column("raw", postgresql.JSONB()),
        sa.Column("content_hash", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id", "column_id"],
            ["curation_columns.project_id", "curation_columns.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("project_id", "id", name="uq_curation_stubs_project_id"),
    )
    op.create_table(
        "curation_stub_tags",
        sa.Column(
            "stub_pk",
            sa.BigInteger(),
            sa.ForeignKey("curation_stubs.pk", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("position", sa.Integer(), primary_key=True),
        sa.Column("tag_id", sa.Text()),
        sa.Column("tag", postgresql.JSONB()),
    )
    op.create_table(
        "curation_tags",
        _project_fk(),
        sa.Column("tag_list", sa.Text(), primary_key=True),
        sa.Column("position", sa.Integer(), primary_key=True),
        sa.Column("id", sa.Text()),
        sa.Column("label", sa.Text()),
        sa.Column("is_exclusion_tag", sa.Boolean()),
        sa.Column("is_assignable", sa.Boolean()),
        *_shape(),
        sa.CheckConstraint(
            "tag_list IN ('info', 'exclusion', 'identification', 'screening', 'eligibility')",
            name="ck_curation_tags_tag_list",
        ),
    )
    op.create_table(
        "curation_sources",
        _project_fk(),
        sa.Column("position", sa.Integer(), primary_key=True),
        sa.Column("id", sa.Text()),
        sa.Column("label", sa.Text()),
        *_shape(),
    )
    op.create_table(
        "curation_imports",
        _project_fk(),
        sa.Column("position", sa.Integer(), primary_key=True),
        sa.Column("id", sa.Text()),
        sa.Column("name", sa.Text()),
        sa.Column("date", sa.Text()),
        sa.Column("import_mode", sa.Text()),
        sa.Column("num_imported", sa.Integer()),
        sa.Column("neurostore_search_params", sa.Text()),
        sa.Column("file_name", sa.Text()),
        *_shape(),
    )
    op.create_table(
        "extraction_study_statuses",
        _project_fk(),
        sa.Column("position", sa.Integer(), primary_key=True),
        sa.Column("study_id", sa.Text()),
        sa.Column("status", sa.Text()),
        *_shape(),
    )
    op.add_column("projects", sa.Column("provenance_extra", postgresql.JSONB()))

    migration.upgrade(op.get_bind())

    # indexes after the bulk load
    op.create_index(
        "ix_curation_stubs_board", "curation_stubs", ["project_id", "column_id", "position"]
    )
    op.create_index("ix_curation_stubs_neurostore_id", "curation_stubs", ["neurostore_id"])
    op.create_index("ix_curation_stub_tags_tag_id", "curation_stub_tags", ["tag_id"])
    op.drop_column("projects", "provenance")


def downgrade():
    op.add_column("projects", sa.Column("provenance", sa.JSON()))
    migration.downgrade(op.get_bind())
    op.drop_column("projects", "provenance_extra")
    for table in reversed(migration.TABLES):
        op.drop_table(table)
