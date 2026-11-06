"""the public query's datasets: public records only, narrow, refreshed nightly

Revision ID: e5b7d9f1a3c4
Revises: c3e5a7b9d1f2
Create Date: 2026-11-06

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "e5b7d9f1a3c4"
down_revision = "c3e5a7b9d1f2"
branch_labels = None
depends_on = None

READER = "neurostore_public_query"

# A row is public when its own flag (or its study's) says so and, for a base study,
# it is active. Each dataset's columns are the allow-list in
# neurostore/public_query.py (docs/public-query/DESIGN.md).
PUBLIC_BASE_STUDY = "b.is_active IS TRUE AND b.public IS TRUE"

DATASETS = {
    "base_studies": f"""
        SELECT b.id, b.name AS title, b.year, b.doi, b.pmid, b.pmcid, b.journal_id,
               b.publication AS journal, b.journal_abbreviation, b.is_oa,
               b.publication_status, b.is_retracted, b.license::text AS license, b.level,
               b.has_coordinates, b.has_images, b.has_z_maps, b.has_t_maps,
               b.has_beta_and_variance_maps, b.created_at, b.updated_at
        FROM base_studies b
        WHERE {PUBLIC_BASE_STUDY}""",
    "journals": f"""
        SELECT j.id, j.openalex_id, j.kind, j.title, j.abbreviation, j.issn_l, j.nlm_id,
               j.wikidata_id, count(b.id)::integer AS base_studies,
               (count(b.id) FILTER (WHERE b.has_coordinates OR b.has_images))::integer
                   AS base_studies_with_data
        FROM journals j
        LEFT JOIN base_studies b ON b.journal_id = j.id AND {PUBLIC_BASE_STUDY}
        GROUP BY j.id""",
    "authors": f"""
        SELECT au.id, au.name, au.orcid, au.openalex_id,
               count(DISTINCT b.id)::integer AS base_studies,
               (count(DISTINCT b.id) FILTER (WHERE b.has_coordinates OR b.has_images))::integer
                   AS base_studies_with_data
        FROM authors au
        JOIN base_study_authors ba ON ba.author_id = au.id
        JOIN base_studies b ON b.id = ba.base_study_id
        WHERE {PUBLIC_BASE_STUDY}
        GROUP BY au.id""",
    "authorships": f"""
        SELECT ba.base_study_id, ba.author_id, au.name AS author_name,
               ba.name AS printed_name, au.orcid, au.openalex_id, ba.position,
               ba.corresponding, b.year, b.journal_id, b.has_coordinates, b.has_images
        FROM base_study_authors ba
        JOIN base_studies b ON b.id = ba.base_study_id
        JOIN authors au ON au.id = ba.author_id
        WHERE {PUBLIC_BASE_STUDY}""",
    "institutions": f"""
        SELECT u.id, u.ror, u.name, u.country,
               count(DISTINCT ba.base_study_id)::integer AS base_studies
        FROM universities u
        JOIN base_study_author_affiliations aff ON aff.university_id = u.id
        JOIN base_study_authors ba ON ba.id = aff.base_study_author_id
        JOIN base_studies b ON b.id = ba.base_study_id
        WHERE {PUBLIC_BASE_STUDY}
        GROUP BY u.id""",
    "affiliations": f"""
        SELECT DISTINCT ba.base_study_id, aff.university_id AS institution_id,
               u.name AS institution, u.ror, u.country, b.year, b.journal_id
        FROM base_study_author_affiliations aff
        JOIN base_study_authors ba ON ba.id = aff.base_study_author_id
        JOIN base_studies b ON b.id = ba.base_study_id
        JOIN universities u ON u.id = aff.university_id
        WHERE {PUBLIC_BASE_STUDY}""",
    # A name holding an email address is never served.
    "studies": """
        SELECT s.id, s.base_study_id, s.name, s.year, s.level, s.source,
               CASE WHEN u.name LIKE '%@%' THEN NULL ELSE u.name END AS username,
               s.created_at, s.updated_at, s.has_coordinates, s.has_images
        FROM studies s
        LEFT JOIN users u ON u.external_id = s.user_id
        WHERE s.public IS TRUE""",
    "analyses": """
        SELECT a.id, a.study_id, s.base_study_id, a.name, s.level, s.source,
               a.point_count, a.image_count, a.has_coordinates, a.has_images, a.role,
               a.outcome, a.created_at, a.updated_at
        FROM analyses a
        JOIN studies s ON s.id = a.study_id
        WHERE s.public IS TRUE""",
}

# A unique index on each dataset's key lets REFRESH ... CONCURRENTLY run without
# blocking readers; the rest serve the "most first" orderings of the rollups.
INDEXES = [
    "CREATE UNIQUE INDEX ON public_query.base_studies (id)",
    "CREATE UNIQUE INDEX ON public_query.journals (id)",
    "CREATE INDEX ON public_query.journals (base_studies DESC)",
    "CREATE UNIQUE INDEX ON public_query.authors (id)",
    "CREATE INDEX ON public_query.authors (base_studies_with_data DESC, base_studies DESC)",
    "CREATE INDEX ON public_query.authors (base_studies DESC)",
    "CREATE UNIQUE INDEX ON public_query.authorships (base_study_id, position)",
    "CREATE UNIQUE INDEX ON public_query.institutions (id)",
    "CREATE INDEX ON public_query.institutions (base_studies DESC)",
    "CREATE UNIQUE INDEX ON public_query.affiliations (base_study_id, institution_id)",
    "CREATE UNIQUE INDEX ON public_query.studies (id)",
    "CREATE UNIQUE INDEX ON public_query.analyses (id)",
]


def upgrade():
    # A role is cluster-wide, so another database may have made it already.
    op.execute(
        f"""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{READER}') THEN
                CREATE ROLE {READER} NOLOGIN;
            END IF;
        END $$
        """
    )
    # The app enters the role for each query (SET LOCAL ROLE).
    op.execute(f"GRANT {READER} TO CURRENT_USER")
    op.execute("CREATE SCHEMA public_query")
    op.execute("CREATE TABLE public_query.refreshed (refreshed_at timestamptz NOT NULL)")
    op.execute("INSERT INTO public_query.refreshed VALUES (now())")
    for name, query in DATASETS.items():
        op.execute(f"CREATE MATERIALIZED VIEW public_query.{name} AS {query}")
    for index in INDEXES:
        op.execute(index)
    op.execute(f"GRANT USAGE ON SCHEMA public_query TO {READER}")
    op.execute(f"GRANT SELECT ON ALL TABLES IN SCHEMA public_query TO {READER}")


def downgrade():
    op.execute("DROP SCHEMA public_query CASCADE")
    # The role stays: it is cluster-wide, and other databases may use it.
