"""base_studies.modalities: the modalities of a paper's analyses, for the list's filter

Revision ID: a88cb14fb489
Revises: d5f7a9c1e3b6
Create Date: 2026-11-19

The union of the paper's `analysis_features.modalities`, sorted. Statement-level triggers on
analysis_features keep it, so every writer (the ingester's rewrite, a merge, a cascade from
a deleted analysis, study or base study) updates it. Existing papers are filled here.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a88cb14fb489"
down_revision = "d5f7a9c1e3b6"
branch_labels = None
depends_on = None

# Sets each of the papers' copy from their features; a paper whose copy is already right
# is not written.
SET_MODALITIES = """
CREATE FUNCTION set_base_study_modalities(ids text[]) RETURNS void AS $$
    UPDATE base_studies b
    SET modalities = fresh.modalities
    FROM (
        SELECT paper.id, coalesce(
            (SELECT array_agg(DISTINCT value ORDER BY value)
             FROM analysis_features f, unnest(f.modalities) AS value
             WHERE f.base_study_id = paper.id AND value IS NOT NULL),
            '{}'
        ) AS modalities
        FROM unnest(ids) AS paper(id)
    ) fresh
    WHERE b.id = fresh.id AND b.modalities IS DISTINCT FROM fresh.modalities
$$ LANGUAGE sql
"""

# One function for the three triggers: a transition table exists only for its own events.
REFRESH = """
CREATE FUNCTION refresh_base_study_modalities() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM set_base_study_modalities(ARRAY(SELECT DISTINCT base_study_id FROM new_rows));
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM set_base_study_modalities(ARRAY(SELECT DISTINCT base_study_id FROM old_rows));
    ELSE
        PERFORM set_base_study_modalities(ARRAY(
            SELECT base_study_id FROM new_rows UNION SELECT base_study_id FROM old_rows
        ));
    END IF;
    RETURN NULL;
END
$$ LANGUAGE plpgsql
"""

TRIGGERS = {
    "analysis_features_modalities_insert": ("INSERT", "NEW TABLE AS new_rows"),
    "analysis_features_modalities_delete": ("DELETE", "OLD TABLE AS old_rows"),
    "analysis_features_modalities_update": (
        "UPDATE",
        "OLD TABLE AS old_rows NEW TABLE AS new_rows",
    ),
}


def upgrade():
    op.add_column(
        "base_studies",
        sa.Column(
            "modalities", postgresql.ARRAY(sa.Text()), nullable=False, server_default="{}"
        ),
    )
    op.execute(SET_MODALITIES)
    op.execute(REFRESH)
    for name, (event, tables) in TRIGGERS.items():
        op.execute(
            f"CREATE TRIGGER {name} AFTER {event} ON analysis_features REFERENCING {tables} "
            "FOR EACH STATEMENT EXECUTE FUNCTION refresh_base_study_modalities()"
        )
    op.execute(
        "SELECT set_base_study_modalities(ARRAY(SELECT DISTINCT base_study_id"
        " FROM analysis_features WHERE modalities <> '{}'))"
    )
    op.create_index(
        "ix_base_studies_modalities", "base_studies", ["modalities"], postgresql_using="gin"
    )


def downgrade():
    op.drop_index("ix_base_studies_modalities", table_name="base_studies")
    for name in TRIGGERS:
        op.execute(f"DROP TRIGGER {name} ON analysis_features")
    op.execute("DROP FUNCTION refresh_base_study_modalities()")
    op.execute("DROP FUNCTION set_base_study_modalities(text[])")
    op.drop_column("base_studies", "modalities")
