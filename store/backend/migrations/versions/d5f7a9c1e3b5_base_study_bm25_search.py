"""search base studies with BM25 indexes (ParadeDB pg_search)

Revision ID: d5f7a9c1e3b5
Revises: e7a9c1d3f5b8
Create Date: 2026-10-26 12:00:00.000000

Replaces the generated name + description tsvector and its GIN index with a
BM25 index over the title and abstract, plus the scalar columns the base-study
list filters on, and adds a BM25 index over the text of fulltexts.

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "d5f7a9c1e3b5"
down_revision = "e7a9c1d3f5b8"
branch_labels = None
depends_on = None

TEXT = "pdb.simple('stemmer=english')"
INDEXES = {
    "ix_base_study_search": (
        "base_studies",
        (
            "id",
            f"name::{TEXT}",
            f"description::{TEXT}",
            "is_active",
            "public",
            "user_id::pdb.literal",
            "level::pdb.literal",
            "has_coordinates",
            "has_images",
            "is_oa",
            "year",
            "hashtextextended(id, 0)::pdb.alias('id_order')",
        ),
    ),
    "ix_fulltext_search": ("fulltexts", ("id", f"text::{TEXT}")),
}
UNWEIGHTED = (
    "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))"
)


def upgrade():
    # The downgrade leaves the extension installed.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_search")
    with op.get_context().autocommit_block():
        for index, (table, fields) in INDEXES.items():
            # An updated row stays in a BM25 index, slowing every search, until
            # a vacuum cleans the indexes; by default vacuum skips that when
            # few pages changed.
            op.execute(f"ALTER TABLE {table} SET (vacuum_index_cleanup = on)")
            # An interrupted build leaves an invalid index of the same name.
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {index}")
            columns = ", ".join(f"({field})" for field in fields)
            # One segment: searches run without parallel workers, and each
            # segment is a fixed cost per query. No mutable segment: every row
            # buffered in it made each search about 2 ms slower until the next
            # vacuum.
            op.execute(
                f"CREATE INDEX CONCURRENTLY {index} ON {table} "
                f"USING paradedb ({columns}) "
                "WITH (target_segment_count = 1, mutable_segment_rows = 0)"
            )
    op.execute("ALTER TABLE base_studies DROP COLUMN __ts_vector__")


def downgrade():
    for index, (table, _) in INDEXES.items():
        op.execute(f"DROP INDEX {index}")
        op.execute(f"ALTER TABLE {table} RESET (vacuum_index_cleanup)")
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
