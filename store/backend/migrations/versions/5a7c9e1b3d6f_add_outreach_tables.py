"""add the outreach tables: people, drafts, links, messages, uploads, events, issues

Outreach asks a paper's corresponding author to deposit its maps on NeuroVault. A draft
is our copy of the paper's analyses; a person is an email address, found by its keyed
hash only. No public endpoint serves these tables.

Revision ID: 5a7c9e1b3d6f
Revises: 0ecb2ae2459c
Create Date: 2026-10-30

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "5a7c9e1b3d6f"
down_revision = "0ecb2ae2459c"
branch_labels = None
depends_on = None

DRAFT_STATUSES = (
    "draft", "checked", "contacted", "opened", "uploading", "submitted", "approved",
    "published", "declined", "rejected", "failed", "files_deleted",
)


def _in(column, values):
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def _base_columns():
    return [
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    ]


def _draft_fk():
    return sa.ForeignKeyConstraint(
        ["draft_id"], ["outreach_drafts.id"], ondelete="CASCADE"
    )


def _index(table, *columns, unique=False):
    for column in columns:
        op.create_index(op.f(f"ix_{table}_{column}"), table, [column], unique=unique)


def upgrade():
    op.create_table(
        "outreach_people",
        *_base_columns(),
        sa.Column("email_index", sa.Text(), nullable=False),
        sa.Column("author_id", sa.Text(), nullable=True),
        sa.Column("opted_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bounced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["authors.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email_index"),
    )
    _index("outreach_people", "id", "created_at", "updated_at", "author_id")

    op.create_table(
        "outreach_drafts",
        *_base_columns(),
        sa.Column("base_study_id", sa.Text(), nullable=False),
        sa.Column("person_id", sa.Text(), nullable=True),
        sa.Column("source_study_id", sa.Text(), nullable=True),
        sa.Column("source_sha256", sa.String(length=64), nullable=False),
        sa.Column("analyses", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "collection",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("status", sa.Text(), server_default="draft", nullable=False),
        sa.Column(
            "last_activity_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("requester", sa.Text(), server_default="spam", nullable=False),
        sa.Column("submitter_name", sa.Text(), nullable=True),
        sa.Column("submitter_orcid", sa.Text(), nullable=True),
        sa.Column(
            "submitter_orcid_verified", sa.Boolean(), server_default=sa.false(), nullable=False
        ),
        sa.Column("submitter_user_id", sa.Text(), nullable=True),
        sa.Column("neurovault_collection_id", sa.Integer(), nullable=True),
        sa.CheckConstraint(_in("status", DRAFT_STATUSES), name="ck_outreach_drafts_status"),
        sa.ForeignKeyConstraint(["base_study_id"], ["base_studies.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["person_id"], ["outreach_people.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_study_id"], ["studies.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["submitter_user_id"], ["users.external_id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    _index(
        "outreach_drafts",
        "id", "created_at", "updated_at", "base_study_id", "person_id", "last_activity_at",
    )

    op.create_table(
        "outreach_links",
        *_base_columns(),
        sa.Column("draft_id", sa.Text(), nullable=False),
        sa.Column("token_sha256", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Text(), nullable=True),
        _draft_fk(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_sha256"),
    )
    _index("outreach_links", "id", "created_at", "updated_at", "draft_id")

    op.create_table(
        "outreach_messages",
        *_base_columns(),
        sa.Column("draft_id", sa.Text(), nullable=False),
        sa.Column("person_id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), server_default="invite", nullable=False),
        sa.Column("mode", sa.Text(), server_default="manual", nullable=False),
        sa.Column("batch", sa.Text(), nullable=True),
        sa.Column("template_version", sa.Text(), nullable=True),
        sa.Column(
            "sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("sent_by", sa.Text(), nullable=True),
        sa.CheckConstraint(_in("kind", ("invite", "reminder")), name="ck_outreach_messages_kind"),
        sa.CheckConstraint(_in("mode", ("manual", "service")), name="ck_outreach_messages_mode"),
        _draft_fk(),
        sa.ForeignKeyConstraint(["person_id"], ["outreach_people.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    _index("outreach_messages", "id", "created_at", "updated_at", "draft_id", "person_id", "batch")

    op.create_table(
        "outreach_uploads",
        *_base_columns(),
        sa.Column("draft_id", sa.Text(), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("path", sa.Text(), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("analysis_key", sa.Text(), nullable=True),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("map_type", sa.Text(), nullable=True),
        sa.Column("check_status", sa.Text(), nullable=True),
        sa.Column("check_details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.Text(), nullable=True),
        _draft_fk(),
        sa.PrimaryKeyConstraint("id"),
    )
    _index("outreach_uploads", "id", "created_at", "updated_at", "draft_id")

    op.create_table(
        "outreach_events",
        *_base_columns(),
        sa.Column("draft_id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("actor", sa.Text(), nullable=False),
        sa.Column("actor_id", sa.Text(), nullable=True),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.CheckConstraint(
            _in("actor", ("admin", "author", "system")), name="ck_outreach_events_actor"
        ),
        _draft_fk(),
        sa.PrimaryKeyConstraint("id"),
    )
    _index("outreach_events", "id", "created_at", "updated_at", "draft_id")

    op.create_table(
        "outreach_issues",
        *_base_columns(),
        sa.Column("draft_id", sa.Text(), nullable=False),
        sa.Column("analysis_key", sa.Text(), nullable=True),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("state", sa.Text(), server_default="open", nullable=False),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("resolved_by", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            _in("kind", ("extraction_error", "help", "mismatch")), name="ck_outreach_issues_kind"
        ),
        sa.CheckConstraint(_in("state", ("open", "resolved")), name="ck_outreach_issues_state"),
        _draft_fk(),
        sa.PrimaryKeyConstraint("id"),
    )
    _index("outreach_issues", "id", "created_at", "updated_at", "draft_id")


def downgrade():
    for table in (
        "outreach_issues",
        "outreach_events",
        "outreach_uploads",
        "outreach_messages",
        "outreach_links",
        "outreach_drafts",
        "outreach_people",
    ):
        op.drop_table(table)
