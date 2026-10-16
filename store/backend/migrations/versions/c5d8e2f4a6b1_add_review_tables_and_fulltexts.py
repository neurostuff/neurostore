"""add review tables, stored full texts and the admin-reviewer role

Adds fulltexts, review_sources, reviews, review_ops and review_assignments, a nullable
base_studies.fulltext_id, and the admin-reviewer role. No existing rows change.

Revision ID: c5d8e2f4a6b1
Revises: a7d3e9c1b5f2
Create Date: 2026-10-14

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "c5d8e2f4a6b1"
down_revision = "a7d3e9c1b5f2"
branch_labels = None
depends_on = None

EMPTY_JSONB = sa.text("'{}'::jsonb")


def upgrade():
    op.create_table(
        "fulltexts",
        *_base_columns(),
        sa.Column("base_study_id", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("source_version", sa.Text(), nullable=True),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["base_study_id"], ["base_studies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("base_study_id", "sha256", name="uq_fulltexts_base_study_sha256"),
        sa.CheckConstraint(
            "source IN ('pubget', 'pmc', 'europepmc', 'elsevier', 'springer', 'ace', 'pdf')",
            name="ck_fulltexts_source",
        ),
    )
    _index_base_columns("fulltexts")
    op.create_index(
        "ix_fulltexts_base_study_created", "fulltexts", ["base_study_id", "created_at"]
    )
    op.add_column("base_studies", sa.Column("fulltext_id", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_base_studies_fulltext_id",
        "base_studies",
        "fulltexts",
        ["fulltext_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "review_sources",
        *_base_columns(),
        sa.Column("fulltext_id", sa.Text(), nullable=False),
        sa.Column("parsed_paper", JSONB(), nullable=True),
        sa.Column("coordinate_parse", JSONB(), nullable=True),
        sa.Column("record", JSONB(), nullable=False),
        sa.Column("judgeable_keys", JSONB(), nullable=False),
        sa.Column("pipeline_config_id", sa.Text(), nullable=True),
        sa.Column("run_id", sa.Text(), nullable=True),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("schema_versions", JSONB(), nullable=True),
        sa.Column("record_sha256", sa.String(64), nullable=False),
        sa.Column("loaded_by_id", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["fulltext_id"], ["fulltexts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["pipeline_config_id"], ["pipeline_configs.id"]),
        sa.ForeignKeyConstraint(["loaded_by_id"], ["users.external_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "fulltext_id", "record_sha256", name="uq_review_sources_fulltext_record"
        ),
    )
    _index_base_columns("review_sources")
    _index("review_sources", ["fulltext_id", "pipeline_config_id", "loaded_by_id"])

    op.create_table(
        "reviews",
        *_base_columns(),
        sa.Column("source_id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("state", sa.Text(), nullable=False, server_default="in_progress"),
        sa.Column("record", JSONB(), nullable=False),
        sa.Column("coordinate_revision", JSONB(), nullable=True),
        sa.Column("provenance", JSONB(), nullable=False, server_default=EMPTY_JSONB),
        sa.Column("annotations", JSONB(), nullable=False, server_default=EMPTY_JSONB),
        sa.Column("last_seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_edit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("set_aside_reason", sa.Text(), nullable=True),
        sa.Column("set_aside_note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["source_id"], ["review_sources.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.external_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "state IN ('in_progress', 'submitted', 'reference', 'set_aside')",
            name="ck_reviews_state",
        ),
        sa.CheckConstraint(
            "(state = 'set_aside') = (set_aside_reason IS NOT NULL)", name="ck_reviews_set_aside"
        ),
        sa.CheckConstraint(
            "set_aside_reason IN "
            "('no_usable_text', 'out_of_scope', 'no_results', 'duplicate', 'other')",
            name="ck_reviews_set_aside_reason",
        ),
        sa.UniqueConstraint("source_id", "user_id", name="uq_reviews_source_user"),
    )
    _index_base_columns("reviews")
    _index("reviews", ["user_id"])
    op.create_index(
        "uq_reviews_one_reference_per_source",
        "reviews",
        ["source_id"],
        unique=True,
        postgresql_where=sa.text("state = 'reference'"),
    )

    op.create_table(
        "review_ops",
        *_base_columns(),
        sa.Column("review_id", sa.Text(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("client_op_id", sa.Text(), nullable=False),
        sa.Column("op", JSONB(), nullable=False),
        sa.Column("before", JSONB(), nullable=True),
        sa.Column("after", JSONB(), nullable=True),
        sa.ForeignKeyConstraint(["review_id"], ["reviews.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("review_id", "seq", name="uq_review_ops_review_seq"),
        sa.UniqueConstraint(
            "review_id", "client_op_id", name="uq_review_ops_review_client_op"
        ),
    )
    _index_base_columns("review_ops")

    op.create_table(
        "review_assignments",
        *_base_columns(),
        sa.Column("base_study_id", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("assigned_by_id", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["base_study_id"], ["base_studies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.external_id"]),
        sa.ForeignKeyConstraint(["assigned_by_id"], ["users.external_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "base_study_id", "user_id", name="uq_review_assignments_base_study_user"
        ),
    )
    _index_base_columns("review_assignments")
    _index("review_assignments", ["user_id", "assigned_by_id"])

    op.execute(
        """
        INSERT INTO roles (id, name, description)
        VALUES ('admin-reviewer', 'admin-reviewer', 'Assigns and audits reviews')
        ON CONFLICT DO NOTHING
        """
    )


def downgrade():
    op.execute("DELETE FROM roles_users WHERE role_id = 'admin-reviewer'")
    op.execute("DELETE FROM roles WHERE id = 'admin-reviewer'")
    op.drop_index("uq_reviews_one_reference_per_source", table_name="reviews")
    for table in ("review_assignments", "review_ops", "reviews", "review_sources"):
        op.drop_table(table)
    op.drop_constraint("fk_base_studies_fulltext_id", "base_studies", type_="foreignkey")
    op.drop_column("base_studies", "fulltext_id")
    op.drop_table("fulltexts")


def _base_columns():
    return (
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def _index_base_columns(table: str) -> None:
    _index(table, ["id", "created_at", "updated_at"])


def _index(table: str, columns: list[str]) -> None:
    for column in columns:
        op.create_index(f"ix_{table}_{column}", table, [column])
