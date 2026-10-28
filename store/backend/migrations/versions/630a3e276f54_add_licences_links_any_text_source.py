"""add licences, paper links and link domains; take a full text of any source

Adds base_studies.license and fulltexts.license (study_schema's licence categories),
base_study_links and link_domains, seeded with the repositories a link is sorted by, and
replaces the list of full-text sources with a check that the source is not empty.
See docs/adr/0017-paper-links-and-licences.md.

Revision ID: 630a3e276f54
Revises: d5f7a9c1e3b5
Create Date: 2026-10-27

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "630a3e276f54"
down_revision = "d5f7a9c1e3b5"
branch_labels = None
depends_on = None

# study_schema's LicenseId values at this revision.
LICENSES = (
    "cc-by",
    "cc-by-sa",
    "cc-by-nc",
    "cc-by-nc-sa",
    "cc-by-nd",
    "cc-by-nc-nd",
    "cc0",
    "public-domain",
    "all-rights-reserved",
    "other",
)
LICENSED = ("base_studies", "fulltexts")
OLD_SOURCES = ("pubget", "pmc", "europepmc", "elsevier", "springer", "ace", "pdf")
KINDS = ("data_repository", "code", "preprint", "publisher", "doi_prefix", "other")
# (pattern, repository, kind). A doi.org link is sorted by the prefix of its DOI; the
# doi.org row says only that the link is a DOI.
LINK_DOMAINS = (
    ("osf.io", "OSF", "data_repository"),
    ("10.17605/osf.io", "OSF", "data_repository"),
    ("openneuro.org", "OpenNeuro", "data_repository"),
    ("10.18112/openneuro", "OpenNeuro", "data_repository"),
    ("neurovault.org", "NeuroVault", "data_repository"),
    ("github.com", "GitHub", "code"),
    ("gitlab.com", "GitLab", "code"),
    ("zenodo.org", "Zenodo", "data_repository"),
    ("10.5281", "Zenodo", "data_repository"),
    ("figshare.com", "figshare", "data_repository"),
    ("10.6084", "figshare", "data_repository"),
    ("doi.org", "DOI", "doi_prefix"),
)
# A base_studies statement that has to wait gives up rather than queue every reader
# behind it; the upgrade can then run again.
LOCK_TIMEOUT = "SET LOCAL lock_timeout = '30s'"


def _in(column, values):
    return f"{column} IN ({', '.join(repr(value) for value in values)})"


def upgrade():
    op.execute(LOCK_TIMEOUT)
    for table in LICENSED:
        op.add_column(table, sa.Column("license", sa.String(32), nullable=True))
        # NOT VALID here and validated after the commit below, which reads every row
        # without blocking writes.
        op.execute(
            f"ALTER TABLE {table} ADD CONSTRAINT ck_{table}_license "
            f"CHECK ({_in('license', LICENSES)}) NOT VALID"
        )

    op.drop_constraint("ck_fulltexts_source", "fulltexts", type_="check")
    op.create_check_constraint("ck_fulltexts_source_not_empty", "fulltexts", "source <> ''")

    op.create_table(
        "base_study_links",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("base_study_id", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("host", sa.Text(), nullable=False),
        sa.Column("registrable_domain", sa.Text(), nullable=False),
        sa.Column("has_nifti", sa.Boolean(), nullable=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["base_study_id"], ["base_studies.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("base_study_id", "url", name="uq_base_study_links_base_study_url"),
        sa.CheckConstraint(
            "source IN ('pipeline', 'user')", name="ck_base_study_links_source"
        ),
    )
    for column in (
        "id",
        "created_at",
        "updated_at",
        "base_study_id",
        "host",
        "registrable_domain",
    ):
        op.create_index(
            op.f(f"ix_base_study_links_{column}"), "base_study_links", [column], unique=False
        )

    link_domains = op.create_table(
        "link_domains",
        sa.Column("pattern", sa.Text(), nullable=False),
        sa.Column("repository", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("pattern"),
        sa.CheckConstraint(_in("kind", KINDS), name="ck_link_domains_kind"),
    )
    op.bulk_insert(
        link_domains,
        [
            {"pattern": pattern, "repository": repository, "kind": kind}
            for pattern, repository, kind in LINK_DOMAINS
        ],
    )
    with op.get_context().autocommit_block():
        for table in LICENSED:
            op.execute(f"ALTER TABLE {table} VALIDATE CONSTRAINT ck_{table}_license")


def downgrade():
    op.execute(LOCK_TIMEOUT)
    op.drop_table("link_domains")
    op.drop_table("base_study_links")
    op.drop_constraint("ck_fulltexts_source_not_empty", "fulltexts", type_="check")
    # NOT VALID: a full text of another source, taken since the upgrade, stays.
    op.execute(
        "ALTER TABLE fulltexts ADD CONSTRAINT ck_fulltexts_source "
        f"CHECK ({_in('source', OLD_SOURCES)}) NOT VALID"
    )
    for table in LICENSED:
        op.drop_column(table, "license")
