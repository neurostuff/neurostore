"""search base studies with BM25 indexes (ParadeDB pg_search)

Revision ID: d5f7a9c1e3b5
Revises: e7a9c1d3f5b8
Create Date: 2026-10-26 12:00:00.000000

Replaces the generated name + description tsvector and its GIN index with a
BM25 index over the title and abstract, plus the scalar columns the base-study
list filters on. Gives each base study's preferred full text a copy of those
columns, kept by triggers, and a BM25 index over its text and the copy.

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d5f7a9c1e3b5"
down_revision = "e7a9c1d3f5b8"
branch_labels = None
depends_on = None

TEXT = "pdb.simple('stemmer=english')"
FILTERS = (
    "is_active",
    "public",
    "user_id::pdb.literal",
    "level::pdb.literal",
    "has_coordinates",
    "has_images",
    "is_oa",
    "year",
)
INDEXES = {
    "ix_base_study_search": (
        "base_studies",
        (
            "id",
            f"name::{TEXT}",
            f"description::{TEXT}",
            *FILTERS,
            # A full-text search finds papers with no full text here.
            "fulltext_id::pdb.literal",
            "hashtextextended(id, 0)::pdb.alias('id_order')",
        ),
    ),
    "ix_fulltext_search": (
        "fulltexts",
        (
            "id",
            f"text::{TEXT}",
            f"name::{TEXT}",
            f"description::{TEXT}",
            *FILTERS,
            "hashtextextended(base_study_id, 0)::pdb.alias('id_order')",
        ),
    ),
}
# The base study columns its preferred full text holds a copy of.
COPIED = {
    "name": "text",
    "description": "text",
    "is_active": "boolean",
    "public": "boolean",
    "user_id": "text",
    "level": "text",
    "has_coordinates": "boolean",
    "has_images": "boolean",
    "is_oa": "boolean",
    "year": "integer",
}
UNWEIGHTED = (
    "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))"
)


def _set_copy(source):
    return ", ".join(f"{column} = {source}.{column}" for column in COPIED)


def upgrade():
    # The downgrade leaves the extension installed.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_search")
    op.execute(
        "ALTER TABLE fulltexts "
        + ", ".join(f"ADD COLUMN {column} {kind}" for column, kind in COPIED.items())
    )
    cleared = ", ".join(f"{column} = NULL" for column in COPIED)
    # Every writer of base_studies goes through these, whatever it is: the
    # copy moves with fulltext_id and follows every edit of a copied column.
    # A full text another base study now points to keeps its copy (a row
    # moved between base studies is re-pointed in either order).
    op.execute(
        f"""
        CREATE FUNCTION base_studies_copy_to_fulltext() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'UPDATE' AND OLD.fulltext_id IS DISTINCT FROM NEW.fulltext_id
            THEN
                UPDATE fulltexts SET {cleared}
                WHERE id = OLD.fulltext_id AND NOT EXISTS (
                    SELECT 1 FROM base_studies WHERE fulltext_id = OLD.fulltext_id
                );
            END IF;
            IF NEW.fulltext_id IS NOT NULL THEN
                UPDATE fulltexts SET {_set_copy("NEW")} WHERE id = NEW.fulltext_id;
            END IF;
            RETURN NULL;
        END
        $$ LANGUAGE plpgsql
        """
    )
    watched = ("fulltext_id", *COPIED)
    op.execute(
        "CREATE TRIGGER base_studies_copy_to_fulltext_insert "
        "AFTER INSERT ON base_studies FOR EACH ROW "
        "WHEN (NEW.fulltext_id IS NOT NULL) "
        "EXECUTE FUNCTION base_studies_copy_to_fulltext()"
    )
    op.execute(
        "CREATE TRIGGER base_studies_copy_to_fulltext_update "
        f"AFTER UPDATE OF {', '.join(watched)} ON base_studies FOR EACH ROW "
        f"WHEN (({', '.join(f'OLD.{c}' for c in watched)}) "
        f"IS DISTINCT FROM ({', '.join(f'NEW.{c}' for c in watched)})) "
        "EXECUTE FUNCTION base_studies_copy_to_fulltext()"
    )
    with op.get_context().autocommit_block():
        # After the triggers, so a base study edited meanwhile is copied either
        # way; in batches that each commit, so an edit waits on at most one.
        conn = op.get_bind()
        last = ""
        while batch := conn.execute(
            sa.text("SELECT id FROM fulltexts WHERE id > :last ORDER BY id LIMIT 1000"),
            {"last": last},
        ).scalars().all():
            conn.execute(
                sa.text(
                    f"UPDATE fulltexts f SET {_set_copy('b')} FROM base_studies b "
                    "WHERE b.fulltext_id = f.id AND f.id = ANY(:batch)"
                ),
                {"batch": batch},
            )
            last = batch[-1]
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
    op.execute("DROP TRIGGER base_studies_copy_to_fulltext_insert ON base_studies")
    op.execute("DROP TRIGGER base_studies_copy_to_fulltext_update ON base_studies")
    op.execute("DROP FUNCTION base_studies_copy_to_fulltext()")
    op.execute(
        "ALTER TABLE fulltexts "
        + ", ".join(f"DROP COLUMN {column}" for column in COPIED)
    )
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
