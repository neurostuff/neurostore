"""search base studies with a BM25 index (ParadeDB pg_search)

Revision ID: d5f7a9c1e3b5
Revises: e7a9c1d3f5b8
Create Date: 2026-10-26 12:00:00.000000

Replaces the generated name + description tsvector and its GIN index with one
BM25 index over the title, the abstract and the full text, plus the scalar
columns the base-study list filters on.

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "d5f7a9c1e3b5"
down_revision = "e7a9c1d3f5b8"
branch_labels = None
depends_on = None

INDEX = "ix_base_study_search"
FIELDS = (
    "id",
    "name::pdb.simple('stemmer=english')",
    "description::pdb.simple('stemmer=english')",
    "pubget_fulltext::pdb.simple('stemmer=english')",
    "ace_fulltext::pdb.simple('stemmer=english')",
    "is_active",
    "public",
    "user_id::pdb.literal",
    "level::pdb.literal",
    "has_coordinates",
    "has_images",
    "is_oa",
    "year",
    "hashtextextended(id, 0)::pdb.alias('id_order')",
)
UNWEIGHTED = (
    "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))"
)


def upgrade():
    # The downgrade leaves the extension installed.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_search")
    # An updated row stays in the BM25 index, slowing every search, until a
    # vacuum cleans the indexes; by default vacuum skips that when few pages
    # changed.
    op.execute("ALTER TABLE base_studies SET (vacuum_index_cleanup = on)")
    with op.get_context().autocommit_block():
        # An interrupted build leaves an invalid index of the same name.
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX}")
        columns = ", ".join(f"({field})" for field in FIELDS)
        # One segment: searches run without parallel workers, and each segment
        # is a fixed cost per query. No mutable segment: every row buffered in
        # it made each search about 2 ms slower until the next vacuum.
        op.execute(
            f"CREATE INDEX CONCURRENTLY {INDEX} ON base_studies "
            f"USING paradedb ({columns}) "
            "WITH (target_segment_count = 1, mutable_segment_rows = 0)"
        )
    op.execute("ALTER TABLE base_studies DROP COLUMN __ts_vector__")


def downgrade():
    op.execute(f"DROP INDEX {INDEX}")
    op.execute("ALTER TABLE base_studies RESET (vacuum_index_cleanup)")
    # pg_search stays: it caches catalog ids per connection, so dropping and
    # re-creating it breaks every connection opened before.
    op.execute(
        "ALTER TABLE base_studies ADD COLUMN __ts_vector__ tsvector "
        f"GENERATED ALWAYS AS ({UNWEIGHTED}) STORED"
    )
    op.execute(
        "CREATE INDEX ix_base_study___ts_vector__ "
        "ON base_studies USING gin (__ts_vector__)"
    )
