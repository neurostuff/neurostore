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


# fulltext_preference at this revision: copy version, then source, then the
# newest, then the smallest id.
PREFERENCE = (
    "CASE f.text_copy->>'version' WHEN 'vor' THEN 0 WHEN 'am' THEN 2 "
    "WHEN 'submitted' THEN 3 ELSE 1 END, "
    "CASE f.source WHEN 'ace' THEN 1 WHEN 'pdf' THEN 2 ELSE 0 END, "
    "f.created_at DESC, f.id"
)
CLEARED = ", ".join(f"{column} = NULL" for column in COPIED)
BATCH = 1000
# The statements that lock base_studies exclusively give up rather than queue
# every reader behind a long transaction; the upgrade can then run again.
LOCK_TIMEOUT = "SET LOCAL lock_timeout = '30s'"
# Every update leaves its row's old version, and heap pages no longer marked
# all-visible, for each search to check until a vacuum; vacuum after 50 rows
# rather than after a fifth of the table.
TABLE_OPTIONS = {
    "vacuum_index_cleanup": "on",
    "autovacuum_vacuum_scale_factor": "0",
    "autovacuum_vacuum_threshold": "50",
    "autovacuum_vacuum_insert_scale_factor": "0",
    "autovacuum_vacuum_insert_threshold": "50",
}
# Merge layers from 16 kB, four times apart: a single-row write adds a segment
# of 4-20 kB, which the default first layer (100 kB) leaves unmerged until
# dozens have accumulated, each a fixed cost per search.
BACKGROUND_LAYER_SIZES = "16kB, 64kB, 256kB, 1MB, 4MB, 16MB, 64MB, 256MB, 1GB"


def _set_copy(source):
    return ", ".join(f"{column} = {source}.{column}" for column in COPIED)


def upgrade():
    # The downgrade leaves the extension installed. Each step can run again
    # after an interrupted upgrade.
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_search")
    op.execute(
        "ALTER TABLE fulltexts "
        + ", ".join(
            f"ADD COLUMN IF NOT EXISTS {column} {kind}" for column, kind in COPIED.items()
        )
    )
    # Every writer of base_studies goes through this trigger, whatever it is:
    # the copy moves with fulltext_id and follows every edit of a copied
    # column, onto the base study's own full text only. While a full text
    # moves between base studies inside one transaction, both may point to it
    # for a moment; the one that still points keeps its copy.
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION base_studies_copy_to_fulltext() RETURNS trigger AS $$
        BEGIN
            IF OLD.fulltext_id IS DISTINCT FROM NEW.fulltext_id THEN
                UPDATE fulltexts SET {CLEARED}
                WHERE id = OLD.fulltext_id AND NOT EXISTS (
                    SELECT 1 FROM base_studies WHERE fulltext_id = OLD.fulltext_id
                );
            END IF;
            IF NEW.fulltext_id IS NOT NULL THEN
                UPDATE fulltexts SET {_set_copy("NEW")}
                WHERE id = NEW.fulltext_id AND base_study_id = NEW.id;
            END IF;
            RETURN NULL;
        END
        $$ LANGUAGE plpgsql
        """
    )
    watched = ("fulltext_id", *COPIED)
    op.execute("DROP TRIGGER IF EXISTS base_studies_copy_to_fulltext ON base_studies")
    op.execute(
        "CREATE TRIGGER base_studies_copy_to_fulltext "
        f"AFTER UPDATE OF {', '.join(watched)} ON base_studies FOR EACH ROW "
        f"WHEN (({', '.join(f'OLD.{c}' for c in watched)}) "
        f"IS DISTINCT FROM ({', '.join(f'NEW.{c}' for c in watched)})) "
        "EXECUTE FUNCTION base_studies_copy_to_fulltext()"
    )
    # A full text moved to another base study drops the old one's copy; the
    # new one copies its own when it points to it.
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION fulltexts_drop_moved_copy() RETURNS trigger AS $$
        BEGIN
            {" ".join(f"NEW.{column} := NULL;" for column in COPIED)}
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
        """
    )
    op.execute("DROP TRIGGER IF EXISTS fulltexts_drop_moved_copy ON fulltexts")
    op.execute(
        "CREATE TRIGGER fulltexts_drop_moved_copy "
        "BEFORE UPDATE OF base_study_id ON fulltexts FOR EACH ROW "
        "WHEN (OLD.base_study_id IS DISTINCT FROM NEW.base_study_id) "
        "EXECUTE FUNCTION fulltexts_drop_moved_copy()"
    )
    # A base study pointing to another one's full text (an ORM move used to
    # leave one behind) points to its own best one instead, so the key below
    # holds for every row.
    op.execute(
        f"""
        UPDATE base_studies b SET fulltext_id = (
            SELECT f.id FROM fulltexts f WHERE f.base_study_id = b.id
            ORDER BY {PREFERENCE} LIMIT 1
        )
        WHERE b.fulltext_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM fulltexts f WHERE f.id = b.fulltext_id AND f.base_study_id = b.id
        )
        """
    )
    with op.get_context().autocommit_block():
        # After the trigger, and locking the base studies first as an edit
        # does, so an edit made meanwhile is never overwritten by an older
        # copy. In batches that each commit, so an edit waits on at most one.
        conn = op.get_bind()
        last = ""
        while batch := conn.execute(
            sa.text("SELECT id FROM fulltexts WHERE id > :last ORDER BY id LIMIT :size"),
            {"last": last, "size": BATCH},
        ).scalars().all():
            conn.execute(
                sa.text(
                    f"UPDATE fulltexts f SET {_set_copy('b')} FROM ("
                    "SELECT * FROM base_studies WHERE fulltext_id = ANY(:batch) FOR UPDATE"
                    ") b WHERE b.fulltext_id = f.id AND b.id = f.base_study_id"
                ),
                {"batch": batch},
            )
            last = batch[-1]
        for index, (table, fields) in INDEXES.items():
            # An updated row stays in a BM25 index, slowing every search, until
            # a vacuum cleans the indexes; by default vacuum skips that when
            # few pages changed.
            options = ", ".join(f"{name} = {value}" for name, value in TABLE_OPTIONS.items())
            op.execute(f"ALTER TABLE {table} SET ({options})")
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
                "WITH (target_segment_count = 1, mutable_segment_rows = 0, "
                f"background_layer_sizes = '{BACKGROUND_LAYER_SIZES}')"
            )
        op.execute(
            "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_fulltexts_id_base_study_id "
            "ON fulltexts (id, base_study_id)"
        )
    op.execute(LOCK_TIMEOUT)
    op.execute(
        """
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'uq_fulltexts_id_base_study_id'
            ) THEN
                ALTER TABLE fulltexts ADD CONSTRAINT uq_fulltexts_id_base_study_id
                UNIQUE USING INDEX uq_fulltexts_id_base_study_id;
            END IF;
        END $$
        """
    )
    # A base study points only to one of its own full texts: the copy and the
    # search rest on it. Deferred, so a full text can move to another base
    # study and both be re-pointed in the same transaction. NOT VALID here
    # and validated below, which checks the rows without blocking writes.
    op.execute(
        "ALTER TABLE base_studies DROP CONSTRAINT IF EXISTS fk_base_studies_fulltext_id"
    )
    op.execute(
        "ALTER TABLE base_studies ADD CONSTRAINT fk_base_studies_fulltext_id "
        "FOREIGN KEY (fulltext_id, id) REFERENCES fulltexts (id, base_study_id) "
        "ON DELETE SET NULL (fulltext_id) DEFERRABLE INITIALLY DEFERRED NOT VALID"
    )
    op.execute("ALTER TABLE base_studies DROP COLUMN IF EXISTS __ts_vector__")
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TABLE base_studies VALIDATE CONSTRAINT fk_base_studies_fulltext_id"
        )


def downgrade():
    for index, (table, _) in INDEXES.items():
        op.execute(f"DROP INDEX {index}")
        op.execute(f"ALTER TABLE {table} RESET ({', '.join(TABLE_OPTIONS)})")
    op.execute("ALTER TABLE base_studies DROP CONSTRAINT fk_base_studies_fulltext_id")
    op.execute(
        "ALTER TABLE base_studies ADD CONSTRAINT fk_base_studies_fulltext_id "
        "FOREIGN KEY (fulltext_id) REFERENCES fulltexts (id) ON DELETE SET NULL"
    )
    op.execute("ALTER TABLE fulltexts DROP CONSTRAINT uq_fulltexts_id_base_study_id")
    op.execute("DROP TRIGGER base_studies_copy_to_fulltext ON base_studies")
    op.execute("DROP FUNCTION base_studies_copy_to_fulltext()")
    op.execute("DROP TRIGGER fulltexts_drop_moved_copy ON fulltexts")
    op.execute("DROP FUNCTION fulltexts_drop_moved_copy()")
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
