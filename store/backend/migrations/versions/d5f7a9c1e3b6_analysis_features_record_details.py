"""analysis_features: what each analysis links to beyond its conditions, tasks and
contrast: its sample, inference settings, acquisitions, preprocessing, model, statistic,
connectivity, regions, coordinate sets and task details

Revision ID: d5f7a9c1e3b6
Revises: b8d0f2a4c6e9
Create Date: 2026-11-10

The columns are NULL on existing rows until `manage backfill-analysis-features` rewrites
them. Each number array has a generated `<name>_points`, its items as a `float8multirange`
of points, which a range criterion overlaps through a GiST index; adding them rewrites the
table once.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "d5f7a9c1e3b6"
down_revision = "b8d0f2a4c6e9"
branch_labels = None
depends_on = None

TABLE = "analysis_features"
TEXT_ARRAY = postgresql.ARRAY(sa.Text())
FLOAT_ARRAY = postgresql.ARRAY(sa.Float())
COLUMNS = (
    ("age_means", FLOAT_ARRAY),
    ("age_sds", FLOAT_ARRAY),
    ("age_minimums", FLOAT_ARRAY),
    ("age_maximums", FLOAT_ARRAY),
    ("age_medians", FLOAT_ARRAY),
    ("female_count", sa.BigInteger()),
    ("male_count", sa.BigInteger()),
    ("female_percent", sa.Float()),
    ("handedness", TEXT_ARRAY),
    ("enrolled_count", sa.BigInteger()),
    ("acquired_count", sa.BigInteger()),
    ("excluded_count", sa.BigInteger()),
    ("diagnostic_instrument_text", sa.Text()),
    ("diagnostic_system_text", sa.Text()),
    ("clinical_text", sa.Text()),
    ("education_text", sa.Text()),
    ("inference_level_text", sa.Text()),
    ("height_threshold", sa.Float()),
    ("height_threshold_type_text", sa.Text()),
    ("cluster_extent", sa.BigInteger()),
    ("cluster_threshold", sa.Float()),
    ("correction_text", sa.Text()),
    ("correction_scope", sa.Text()),
    ("alpha", sa.Float()),
    ("tfce", sa.Boolean()),
    ("permutations", sa.BigInteger()),
    ("modalities", TEXT_ARRAY),
    ("field_strengths", FLOAT_ARRAY),
    ("repetition_times", FLOAT_ARRAY),
    ("echo_times", FLOAT_ARRAY),
    ("voxel_sizes", FLOAT_ARRAY),
    ("scanner_text", sa.Text()),
    ("smoothing_fwhms", FLOAT_ARRAY),
    ("preprocessing_software_text", sa.Text()),
    ("preprocessing_steps_text", sa.Text()),
    ("model_family_text", sa.Text()),
    ("model_type_text", sa.Text()),
    ("model_software_text", sa.Text()),
    ("hrf_model_text", sa.Text()),
    ("estimator_text", sa.Text()),
    ("model_term_text", sa.Text()),
    ("model_term_types", TEXT_ARRAY),
    ("statistic_family", sa.Text()),
    ("df_numerator", sa.Float()),
    ("df_denominator", sa.Float()),
    ("connectivity_method", sa.Text()),
    ("connectivity_inference_target", sa.Text()),
    ("seed_region_text", sa.Text()),
    ("target_region_text", sa.Text()),
    ("region_text", sa.Text()),
    ("region_atlas_text", sa.Text()),
    ("region_types", TEXT_ARRAY),
    ("region_definitions", TEXT_ARRAY),
    ("coordinate_roles", TEXT_ARRAY),
    ("result_kinds", TEXT_ARRAY),
    ("anchor_kinds", TEXT_ARRAY),
    ("stimulus_text", sa.Text()),
    ("stimulus_modalities", TEXT_ARRAY),
    ("response_modalities", TEXT_ARRAY),
    ("design_types", TEXT_ARRAY),
    ("instructions_text", sa.Text()),
    ("performance_text", sa.Text()),
)
GIN = (
    "handedness",
    "modalities",
    "model_term_types",
    "region_types",
    "region_definitions",
    "coordinate_roles",
    "result_kinds",
    "anchor_kinds",
    "stimulus_modalities",
    "response_modalities",
    "design_types",
)
NUMBER_ARRAYS = (
    "age_means",
    "age_sds",
    "age_minimums",
    "age_maximums",
    "age_medians",
    "field_strengths",
    "repetition_times",
    "echo_times",
    "voxel_sizes",
    "smoothing_fwhms",
)
BTREE = (
    "female_count",
    "male_count",
    "female_percent",
    "enrolled_count",
    "acquired_count",
    "excluded_count",
    "height_threshold",
    "cluster_extent",
    "cluster_threshold",
    "correction_scope",
    "alpha",
    "tfce",
    "permutations",
    "statistic_family",
    "df_numerator",
    "df_denominator",
    "connectivity_method",
    "connectivity_inference_target",
)
TRIGRAM = (
    "diagnostic_instrument_text",
    "diagnostic_system_text",
    "clinical_text",
    "education_text",
    "inference_level_text",
    "height_threshold_type_text",
    "correction_text",
    "scanner_text",
    "preprocessing_software_text",
    "preprocessing_steps_text",
    "model_family_text",
    "model_type_text",
    "model_software_text",
    "hrf_model_text",
    "estimator_text",
    "model_term_text",
    "seed_region_text",
    "target_region_text",
    "region_text",
    "region_atlas_text",
    "stimulus_text",
    "instructions_text",
    "performance_text",
)


def upgrade():
    op.execute("CREATE TYPE float8range AS RANGE (subtype = float8, subtype_diff = float8mi)")
    # Qualified: index expressions run with a restricted search_path.
    op.execute(
        """
        CREATE FUNCTION analysis_feature_points(items float8[]) RETURNS public.float8multirange
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $$ SELECT pg_catalog.range_agg(public.float8range(item, item, '[]'))
              FROM pg_catalog.unnest(items) AS item $$
        """
    )
    for name, type_ in COLUMNS:
        op.add_column(TABLE, sa.Column(name, type_, nullable=True))
    op.execute(
        f"ALTER TABLE {TABLE} "
        + ", ".join(
            f"ADD COLUMN {name}_points public.float8multirange"
            f" GENERATED ALWAYS AS (analysis_feature_points({name})) STORED"
            for name in NUMBER_ARRAYS
        )
    )
    for column in GIN:
        op.create_index(f"ix_{TABLE}__{column}", TABLE, [column], postgresql_using="gin")
    for column in NUMBER_ARRAYS:
        op.create_index(
            f"ix_{TABLE}__{column}_points", TABLE, [f"{column}_points"], postgresql_using="gist"
        )
    for column in BTREE:
        op.create_index(f"ix_{TABLE}__{column}", TABLE, [column])
    for column in TRIGRAM:
        op.create_index(
            f"ix_{TABLE}__{column}_trgm",
            TABLE,
            [column],
            postgresql_using="gin",
            postgresql_ops={column: "gin_trgm_ops"},
        )


def downgrade():
    for column in TRIGRAM:
        op.drop_index(f"ix_{TABLE}__{column}_trgm", table_name=TABLE)
    for column in BTREE:
        op.drop_index(f"ix_{TABLE}__{column}", table_name=TABLE)
    for column in NUMBER_ARRAYS:
        op.drop_index(f"ix_{TABLE}__{column}_points", table_name=TABLE)
        op.drop_column(TABLE, f"{column}_points")
    for column in GIN:
        op.drop_index(f"ix_{TABLE}__{column}", table_name=TABLE)
    for name, _ in reversed(COLUMNS):
        op.drop_column(TABLE, name)
    op.execute("DROP FUNCTION analysis_feature_points(float8[])")
    op.execute("DROP TYPE float8range")
