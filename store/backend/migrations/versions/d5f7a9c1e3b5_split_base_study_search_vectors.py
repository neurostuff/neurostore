"""split the base study search vector into a ranking vector and a full-text vector

Revision ID: d5f7a9c1e3b5
Revises: e7a9c1d3f5b8
Create Date: 2026-10-26 12:00:00.000000

The old __ts_vector__ is a generated name + description vector. Changing a
generated column's expression rewrites base_studies under an exclusive lock
for minutes (the full text is copied with it), and a generated column cannot
be added without that rewrite either. So both vectors are plain columns kept
by triggers, filled in batches, indexed concurrently and swapped in at the
end under a lock that only renames.

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "d5f7a9c1e3b5"
down_revision = "e7a9c1d3f5b8"
branch_labels = None
depends_on = None

BATCH = 100

# Must match the triggers' behaviour described on BaseStudy in
# neurostore/models/data.py.
# {r} is "" in plain SQL and "NEW." inside a trigger.
RANKING = (
    "setweight(to_tsvector('english', coalesce({r}name, '')), 'A') || "
    "setweight(to_tsvector('english', coalesce({r}description, '')), 'B')"
)
FULL_TEXT = (
    "to_tsvector('english', coalesce({r}pubget_fulltext, {r}ace_fulltext, ''))"
)
UNWEIGHTED = (
    "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))"
)


def _ranking_function(column):
    return f"""
        CREATE OR REPLACE FUNCTION base_studies_set_ranking_vector()
        RETURNS trigger AS $$
        BEGIN
            NEW.{column} := {RANKING.format(r='NEW.')};
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
    """


def upgrade():
    op.execute(
        "ALTER TABLE base_studies "
        "ADD COLUMN IF NOT EXISTS __ts_vector_new__ tsvector, "
        "ADD COLUMN IF NOT EXISTS __fulltext_vector__ tsvector"
    )
    # With statistics the planner reads the share of matching rows from them
    # and, for a common word, scans the table sequentially, reading every
    # large vector; without them it assumes few matches and uses the GIN
    # indexes, the faster plan at every share. This must come before the
    # backfill: autovacuum analyzes the columns as they fill, and ANALYZE
    # leaves statistics it already has when the target is later set to 0.
    for column in ("__ts_vector_new__", "__fulltext_vector__"):
        op.execute(
            f"ALTER TABLE base_studies ALTER COLUMN {column} SET STATISTICS 0"
        )
    op.execute(_ranking_function("__ts_vector_new__"))
    op.execute(
        f"""
        CREATE OR REPLACE FUNCTION base_studies_set_fulltext_vector()
        RETURNS trigger AS $$
        BEGIN
            NEW.__fulltext_vector__ := {FULL_TEXT.format(r='NEW.')};
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
        """
    )
    # Triggers first, so a row written during the backfill is never missed.
    op.execute("DROP TRIGGER IF EXISTS base_studies_ranking_vector ON base_studies")
    op.execute(
        "CREATE TRIGGER base_studies_ranking_vector "
        "BEFORE INSERT OR UPDATE OF name, description ON base_studies "
        "FOR EACH ROW EXECUTE FUNCTION base_studies_set_ranking_vector()"
    )
    op.execute("DROP TRIGGER IF EXISTS base_studies_fulltext_vector ON base_studies")
    op.execute(
        "CREATE TRIGGER base_studies_fulltext_vector "
        "BEFORE INSERT OR UPDATE OF pubget_fulltext, ace_fulltext ON base_studies "
        "FOR EACH ROW EXECUTE FUNCTION base_studies_set_fulltext_vector()"
    )

    # Each statement commits on its own: no long transaction, no lock beyond
    # the rows of one batch.
    with op.get_context().autocommit_block():
        conn = op.get_bind()
        last = ""
        while True:
            ids = conn.execute(
                sa.text(
                    "UPDATE base_studies b "
                    f"SET __ts_vector_new__ = {RANKING.format(r='')}, "
                    f"__fulltext_vector__ = {FULL_TEXT.format(r='')} "
                    "FROM (SELECT id FROM base_studies WHERE id > :last "
                    "AND (__ts_vector_new__ IS NULL OR __fulltext_vector__ IS NULL) "
                    "ORDER BY id LIMIT :batch) k "
                    "WHERE b.id = k.id RETURNING b.id"
                ),
                {"last": last, "batch": BATCH},
            ).scalars().all()
            if not ids:
                break
            last = max(ids)
        for name, column in (
            ("ix_base_study___ts_vector_new__", "__ts_vector_new__"),
            ("ix_base_study___fulltext_vector__", "__fulltext_vector__"),
        ):
            # An interrupted build leaves an invalid index of the same name.
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
            op.execute(
                f"CREATE INDEX CONCURRENTLY {name} "
                f"ON base_studies USING gin ({column})"
            )
        op.execute("ANALYZE base_studies")

    # The swap only renames, so the exclusive lock is held for milliseconds.
    op.execute("ALTER TABLE base_studies DROP COLUMN __ts_vector__")
    op.execute(
        "ALTER TABLE base_studies RENAME COLUMN __ts_vector_new__ TO __ts_vector__"
    )
    op.execute(
        "ALTER INDEX ix_base_study___ts_vector_new__ "
        "RENAME TO ix_base_study___ts_vector__"
    )
    op.execute(_ranking_function("__ts_vector__"))


def downgrade():
    op.execute("DROP TRIGGER base_studies_ranking_vector ON base_studies")
    op.execute("DROP TRIGGER base_studies_fulltext_vector ON base_studies")
    op.execute("DROP FUNCTION base_studies_set_ranking_vector()")
    op.execute("DROP FUNCTION base_studies_set_fulltext_vector()")
    op.execute("DROP INDEX ix_base_study___fulltext_vector__")
    op.execute("ALTER TABLE base_studies DROP COLUMN __fulltext_vector__")
    op.execute("ALTER TABLE base_studies DROP COLUMN __ts_vector__")
    op.execute(
        "ALTER TABLE base_studies ADD COLUMN __ts_vector__ tsvector "
        f"GENERATED ALWAYS AS ({UNWEIGHTED}) STORED"
    )
    op.execute(
        "CREATE INDEX ix_base_study___ts_vector__ "
        "ON base_studies USING gin (__ts_vector__)"
    )
