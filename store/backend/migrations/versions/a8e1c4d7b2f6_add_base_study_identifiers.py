"""add base_study_identifiers, base_study_merge_candidates and publication_status

Every article id of an active base study goes in base_study_identifiers, unique on
(scheme, value). base_studies.doi, pmid and pmcid stay the version of record's ids and
follow that table's ``vor`` rows through a trigger, so no write path can leave them apart.

Revision ID: a8e1c4d7b2f6
Revises: d4e6f8a0b2c4
Create Date: 2026-10-23

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "a8e1c4d7b2f6"
down_revision = "d4e6f8a0b2c4"
branch_labels = None
depends_on = None


NORMALIZE_FUNCTION = r"""
CREATE FUNCTION normalize_base_study_identifier(scheme text, value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT NULLIF(
        CASE scheme
            WHEN 'doi' THEN regexp_replace(
                lower(btrim(value, E' \t\r\n')),
                '^(https?://(dx\.)?doi\.org/|doi:[ \t\r\n]*)',
                ''
            )
            WHEN 'pmid' THEN coalesce(
                substring(
                    btrim(value, E' \t\r\n')
                    from '(?i)^(?\:https?://pubmed\.ncbi\.nlm\.nih\.gov/|PMID:?[ ]*)?'
                          '([0-9]+)(?![A-Za-z0-9])'
                ),
                btrim(value, E' \t\r\n')
            )
            WHEN 'pmcid' THEN coalesce(
                substring(upper(btrim(value, E' \t\r\n')) from 'PMC[0-9]+'),
                CASE
                    WHEN btrim(value, E' \t\r\n') ~ '^[0-9]+$'
                        THEN 'PMC' || btrim(value, E' \t\r\n')
                    ELSE upper(btrim(value, E' \t\r\n'))
                END
            )
        END,
        ''
    )
$$
"""

# AFTER, so the base study row exists for the identifiers' foreign key. A base study
# that stops being active hands its ids to the one that supersedes it, as alternatives
# (the keeper's own version of record wins), or drops them when nothing supersedes it.
SYNC_FUNCTION = r"""
CREATE FUNCTION sync_base_study_identifiers() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    sch text;
    wanted text;
    held text;
    holder text;
    matched jsonb;
    inserted integer;
    fresh boolean;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.is_active AND NOT NEW.is_active THEN
        IF NEW.superseded_by IS NULL THEN
            DELETE FROM base_study_identifiers WHERE base_study_id = NEW.id;
        ELSE
            UPDATE base_study_identifiers
            SET base_study_id = NEW.superseded_by,
                kind = CASE WHEN kind = 'vor' THEN 'alternative' ELSE kind END
            WHERE base_study_id = NEW.id;
        END IF;
        RETURN NULL;
    END IF;
    IF NOT NEW.is_active THEN
        RETURN NULL;
    END IF;
    FOREACH sch IN ARRAY ARRAY['doi', 'pmid', 'pmcid'] LOOP
        wanted := normalize_base_study_identifier(
            sch,
            CASE sch WHEN 'doi' THEN NEW.doi WHEN 'pmid' THEN NEW.pmid ELSE NEW.pmcid END
        );
        SELECT value INTO held FROM base_study_identifiers
        WHERE base_study_id = NEW.id AND base_study_identifiers.scheme = sch AND kind = 'vor';
        IF wanted IS NOT DISTINCT FROM held THEN
            CONTINUE;
        END IF;
        DELETE FROM base_study_identifiers
        WHERE base_study_id = NEW.id AND base_study_identifiers.scheme = sch AND kind = 'vor';
        IF wanted IS NULL THEN
            CONTINUE;
        END IF;
        UPDATE base_study_identifiers SET kind = 'vor', server = NULL
        WHERE base_study_identifiers.scheme = sch AND value = wanted AND base_study_id = NEW.id;
        IF NOT FOUND THEN
            -- An id another active base study holds stays with it, as the migration leaves
            -- it: this base study keeps it in its column, and the pair is a merge candidate.
            INSERT INTO base_study_identifiers (base_study_id, kind, scheme, value)
            VALUES (NEW.id, 'vor', sch, wanted)
            ON CONFLICT (scheme, value) DO NOTHING;
            GET DIAGNOSTICS inserted = ROW_COUNT;
            IF inserted = 0 THEN
                SELECT base_study_id INTO holder FROM base_study_identifiers
                WHERE base_study_identifiers.scheme = sch AND value = wanted;
                matched := jsonb_build_array(
                    jsonb_build_object('scheme', sch, 'value', wanted, 'kind', 'vor'));
                INSERT INTO base_study_merge_candidates
                    (id, created_at, first_base_study_id, second_base_study_id, matched, source)
                VALUES (
                    left(replace(gen_random_uuid()::text, '-', ''), 12), now(),
                    least(NEW.id COLLATE "C", holder COLLATE "C"),
                    greatest(NEW.id COLLATE "C", holder COLLATE "C"),
                    matched, 'trigger')
                ON CONFLICT (first_base_study_id, second_base_study_id) DO UPDATE
                SET matched = CASE
                    WHEN base_study_merge_candidates.matched @> EXCLUDED.matched
                        THEN base_study_merge_candidates.matched
                    ELSE base_study_merge_candidates.matched || EXCLUDED.matched END
                RETURNING (xmax = 0) INTO fresh;
                IF fresh THEN
                    RAISE WARNING 'identifiers span active base studies: %',
                        jsonb_build_object('source', 'trigger', 'base_study_id', NEW.id,
                                           'also_held_by', jsonb_build_object(holder, matched));
                END IF;
            END IF;
        END IF;
    END LOOP;
    RETURN NULL;
END
$$
"""

# Each active base study's doi, pmid and pmcid. Where active base studies share one, the
# oldest keeps it (the resolver's tie rule for equal ids) and each other is recorded as a
# merge candidate with the shared ids; no row is changed in base_studies.
BACKFILL = r"""
CREATE TEMPORARY TABLE _held AS
SELECT b.id, b.created_at, v.scheme, normalize_base_study_identifier(v.scheme, v.raw) AS value
FROM base_studies b
CROSS JOIN LATERAL (VALUES ('doi', b.doi), ('pmid', b.pmid), ('pmcid', b.pmcid)) AS v(scheme, raw)
WHERE b.is_active
"""

RANKED = r"""
CREATE TEMPORARY TABLE _ranked AS
SELECT id, scheme, value,
       row_number() OVER (
           PARTITION BY scheme, value ORDER BY created_at NULLS LAST, id COLLATE "C"
       ) AS rank
FROM _held WHERE value IS NOT NULL
"""

INSERT_HELD = """
INSERT INTO base_study_identifiers (base_study_id, kind, scheme, value)
SELECT id, 'vor', scheme, value FROM _ranked WHERE rank = 1
"""

INSERT_CANDIDATES = """
INSERT INTO base_study_merge_candidates
    (id, created_at, first_base_study_id, second_base_study_id, matched, source)
SELECT left(replace(gen_random_uuid()::text, '-', ''), 12), now(), first_id, second_id,
       jsonb_agg(jsonb_build_object('scheme', scheme, 'value', value, 'kind', 'vor')
                 ORDER BY scheme, value),
       'migration'
FROM (
    SELECT least(w.id COLLATE "C", l.id COLLATE "C") AS first_id,
           greatest(w.id COLLATE "C", l.id COLLATE "C") AS second_id,
           l.scheme, l.value
    FROM _ranked l
    JOIN _ranked w ON w.scheme = l.scheme AND w.value = l.value AND w.rank = 1
    WHERE l.rank > 1
) pairs
GROUP BY first_id, second_id
"""


def upgrade():
    op.add_column("base_studies", sa.Column("publication_status", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_base_studies_publication_status",
        "base_studies",
        "publication_status IN ('preprint', 'published')",
    )
    op.create_table(
        "base_study_identifiers",
        sa.Column("scheme", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("base_study_id", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("server", sa.Text(), nullable=True),
        sa.CheckConstraint("scheme IN ('doi', 'pmid', 'pmcid')", name="ck_identifier_scheme"),
        sa.CheckConstraint(
            "kind IN ('vor', 'preprint', 'alternative')", name="ck_identifier_kind"
        ),
        sa.CheckConstraint(
            "server IS NULL OR (kind = 'preprint' AND scheme = 'doi')",
            name="ck_identifier_server",
        ),
        sa.ForeignKeyConstraint(["base_study_id"], ["base_studies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("scheme", "value"),
    )
    op.create_index(
        "ix_base_study_identifiers_base_study_id", "base_study_identifiers", ["base_study_id"]
    )
    op.create_index(
        "uq_base_study_identifiers_vor",
        "base_study_identifiers",
        ["base_study_id", "scheme"],
        unique=True,
        postgresql_where=sa.text("kind = 'vor'"),
    )
    op.create_table(
        "base_study_merge_candidates",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_base_study_id", sa.Text(), nullable=False),
        sa.Column("second_base_study_id", sa.Text(), nullable=False),
        sa.Column("matched", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.CheckConstraint(
            'first_base_study_id COLLATE "C" < second_base_study_id COLLATE "C"',
            name="ck_merge_candidate_order",
        ),
        sa.ForeignKeyConstraint(["first_base_study_id"], ["base_studies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["second_base_study_id"], ["base_studies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "first_base_study_id",
            "second_base_study_id",
            name="uq_base_study_merge_candidates_pair",
        ),
    )
    op.create_index("ix_base_study_merge_candidates_id", "base_study_merge_candidates", ["id"])
    op.create_index(
        "ix_base_study_merge_candidates_created_at", "base_study_merge_candidates", ["created_at"]
    )
    op.create_index(
        "ix_base_study_merge_candidates_updated_at", "base_study_merge_candidates", ["updated_at"]
    )
    op.create_index(
        "ix_base_study_merge_candidates_second_base_study_id",
        "base_study_merge_candidates",
        ["second_base_study_id"],
    )

    op.execute(NORMALIZE_FUNCTION)
    for statement in (BACKFILL, RANKED, INSERT_HELD, INSERT_CANDIDATES):
        op.execute(statement)
    op.execute("DROP TABLE _ranked, _held")
    op.execute(SYNC_FUNCTION)
    op.execute(
        """
        CREATE TRIGGER base_studies_sync_identifiers
        AFTER INSERT OR UPDATE OF doi, pmid, pmcid, is_active, superseded_by ON base_studies
        FOR EACH ROW EXECUTE FUNCTION sync_base_study_identifiers()
        """
    )
    # The table is now what keeps an id on one active base study.
    op.drop_index("uq_base_studies_doi_pmid_active", table_name="base_studies")


def downgrade():
    op.create_index(
        "uq_base_studies_doi_pmid_active",
        "base_studies",
        ["doi", "pmid"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )
    op.execute("DROP TRIGGER base_studies_sync_identifiers ON base_studies")
    op.execute("DROP FUNCTION sync_base_study_identifiers()")
    op.drop_table("base_study_merge_candidates")
    op.drop_table("base_study_identifiers")
    op.execute("DROP FUNCTION normalize_base_study_identifier(text, text)")
    op.drop_constraint("ck_base_studies_publication_status", "base_studies", type_="check")
    op.drop_column("base_studies", "publication_status")
