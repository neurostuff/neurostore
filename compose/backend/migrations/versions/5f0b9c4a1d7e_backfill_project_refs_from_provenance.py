"""backfill project neurostore refs from provenance extraction metadata

Populate projects.neurostore_studyset_id / projects.neurostore_annotation_id
from provenance.extractionMetadata.{studysetId,annotationId} when those FK
columns are still NULL. Create missing rows in studyset_references /
annotation_references first so the FK update succeeds. As a fallback, inherit a
single consistent non-null child meta-analysis reference when project-level
provenance is absent.

Revision ID: 5f0b9c4a1d7e
Revises: f3a7d8c9e2b1
Create Date: 2026-04-16 23:30:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "5f0b9c4a1d7e"
down_revision = "f3a7d8c9e2b1"
branch_labels = None
depends_on = None


_PROJECT_STUDYSET_FROM_PROVENANCE = """
NULLIF(
    BTRIM(
        COALESCE(
            provenance->'extractionMetadata'->>'studysetId',
            provenance->'extractionMetadata'->>'studyset_id'
        )
    ),
    ''
)
"""

_PROJECT_ANNOTATION_FROM_PROVENANCE = """
NULLIF(
    BTRIM(
        COALESCE(
            provenance->'extractionMetadata'->>'annotationId',
            provenance->'extractionMetadata'->>'annotation_id'
        )
    ),
    ''
)
"""


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    project_cols = {c["name"] for c in inspector.get_columns("projects")}

    if "neurostore_studyset_id" in project_cols:
        bind.execute(
            sa.text(
                f"""
                INSERT INTO studyset_references (id)
                SELECT DISTINCT {_PROJECT_STUDYSET_FROM_PROVENANCE} AS id
                FROM projects
                WHERE {_PROJECT_STUDYSET_FROM_PROVENANCE} IS NOT NULL
                ON CONFLICT (id) DO NOTHING
                """
            )
        )
        bind.execute(
            sa.text(
                f"""
                UPDATE projects p
                SET neurostore_studyset_id = {_PROJECT_STUDYSET_FROM_PROVENANCE}
                WHERE p.neurostore_studyset_id IS NULL
                  AND {_PROJECT_STUDYSET_FROM_PROVENANCE} IS NOT NULL
                  AND EXISTS (
                      SELECT 1
                      FROM studyset_references sr
                      WHERE sr.id = {_PROJECT_STUDYSET_FROM_PROVENANCE}
                  )
                """
            )
        )
        bind.execute(
            sa.text(
                """
                WITH project_meta_refs AS (
                    SELECT
                        ma.project_id,
                        MIN(ma.neurostore_studyset_id) AS neurostore_studyset_id
                    FROM meta_analyses ma
                    WHERE ma.project_id IS NOT NULL
                      AND ma.neurostore_studyset_id IS NOT NULL
                    GROUP BY ma.project_id
                    HAVING COUNT(DISTINCT ma.neurostore_studyset_id) = 1
                )
                UPDATE projects p
                SET neurostore_studyset_id = pmr.neurostore_studyset_id
                FROM project_meta_refs pmr
                WHERE p.id = pmr.project_id
                  AND p.neurostore_studyset_id IS NULL
                """
            )
        )

    if "neurostore_annotation_id" in project_cols:
        bind.execute(
            sa.text(
                f"""
                INSERT INTO annotation_references (id)
                SELECT DISTINCT {_PROJECT_ANNOTATION_FROM_PROVENANCE} AS id
                FROM projects
                WHERE {_PROJECT_ANNOTATION_FROM_PROVENANCE} IS NOT NULL
                ON CONFLICT (id) DO NOTHING
                """
            )
        )
        bind.execute(
            sa.text(
                f"""
                UPDATE projects p
                SET neurostore_annotation_id = {_PROJECT_ANNOTATION_FROM_PROVENANCE}
                WHERE p.neurostore_annotation_id IS NULL
                  AND {_PROJECT_ANNOTATION_FROM_PROVENANCE} IS NOT NULL
                  AND EXISTS (
                      SELECT 1
                      FROM annotation_references ar
                      WHERE ar.id = {_PROJECT_ANNOTATION_FROM_PROVENANCE}
                  )
                """
            )
        )
        bind.execute(
            sa.text(
                """
                WITH project_meta_refs AS (
                    SELECT
                        ma.project_id,
                        MIN(ma.neurostore_annotation_id) AS neurostore_annotation_id
                    FROM meta_analyses ma
                    WHERE ma.project_id IS NOT NULL
                      AND ma.neurostore_annotation_id IS NOT NULL
                    GROUP BY ma.project_id
                    HAVING COUNT(DISTINCT ma.neurostore_annotation_id) = 1
                )
                UPDATE projects p
                SET neurostore_annotation_id = pmr.neurostore_annotation_id
                FROM project_meta_refs pmr
                WHERE p.id = pmr.project_id
                  AND p.neurostore_annotation_id IS NULL
                """
            )
        )


def downgrade():
    # Irreversible data backfill. Keep populated FK columns in place.
    pass
