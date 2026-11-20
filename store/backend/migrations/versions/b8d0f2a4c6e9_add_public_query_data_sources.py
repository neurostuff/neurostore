"""the public query's data sources, and which public base studies use each

Revision ID: b8d0f2a4c6e9
Revises: b4d6f8a0c2e4
Create Date: 2026-11-06

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b8d0f2a4c6e9"
down_revision = "b4d6f8a0c2e4"
branch_labels = None
depends_on = None

READER = "neurostore_public_query"

# A base study uses a data source when one of its public versions does. The
# base_study_data_sources table counts private versions too, so the datasets read
# study_data_sources instead.
USES = """
    SELECT DISTINCT s.base_study_id, sds.data_source_id
    FROM study_data_sources sds
    JOIN studies s ON s.id = sds.study_id
    JOIN base_studies b ON b.id = s.base_study_id
    WHERE s.public IS TRUE AND b.is_active IS TRUE AND b.public IS TRUE"""

DATASETS = {
    "data_sources": f"""
        WITH uses AS ({USES})
        SELECT d.id, d.name, array_to_string(d.kinds, ', ') AS kinds,
               array_to_string(d.modalities, ', ') AS modalities, d.part_of_id, d.url,
               array_to_string(d.rrids, ', ') AS rrids, count(b.id)::integer AS base_studies,
               (count(b.id) FILTER (WHERE b.has_coordinates OR b.has_images))::integer
                   AS base_studies_with_data
        FROM data_sources d
        LEFT JOIN uses u ON u.data_source_id = d.id
        LEFT JOIN base_studies b ON b.id = u.base_study_id
        GROUP BY d.id""",
    "data_source_uses": f"""
        SELECT u.base_study_id, u.data_source_id, d.name AS data_source, b.year,
               b.journal_id, b.has_coordinates, b.has_images
        FROM ({USES}) u
        JOIN data_sources d ON d.id = u.data_source_id
        JOIN base_studies b ON b.id = u.base_study_id""",
}

INDEXES = [
    "CREATE UNIQUE INDEX ON public_query.data_sources (id)",
    "CREATE INDEX ON public_query.data_sources (base_studies DESC)",
    "CREATE UNIQUE INDEX ON public_query.data_source_uses (base_study_id, data_source_id)",
    "CREATE INDEX ON public_query.data_source_uses (data_source_id)",
]


def upgrade():
    for name, query in DATASETS.items():
        op.execute(f"CREATE MATERIALIZED VIEW public_query.{name} AS {query}")
        op.execute(f"GRANT SELECT ON public_query.{name} TO {READER}")
    for index in INDEXES:
        op.execute(index)


def downgrade():
    for name in DATASETS:
        op.execute(f"DROP MATERIALIZED VIEW public_query.{name}")
