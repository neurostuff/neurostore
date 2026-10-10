"""add study_schema extraction truth layer

Documents and claims for study_schema records: per-analysis extraction
payloads, durable entity identity that survives re-extraction, and
field-level claims with their evidence. No feedback or voting tables yet,
and nothing here is exposed through the API.

Additive. Nothing here alters studies, analyses, points or images; an
extraction hangs off the existing coordinate skeleton. pipeline_study_results
gains a nullable run_id, the caller's id for the run that produced a result.

See store/backend/docs/study-schema-ingestion-design.md.

Revision ID: 28cdbfce7bfa
Revises: e7a9c1d3f5b7
Create Date: 2026-09-18

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "28cdbfce7bfa"
down_revision = "e7a9c1d3f5b7"
branch_labels = None
depends_on = None

# Already created by an earlier migration; reused, not redefined. Must be the
# postgresql ENUM -- create_type is dialect-specific and sa.Enum ignores it,
# which makes alembic emit a CREATE TYPE that collides.
STATUS_ENUM = PGEnum(
    "SUCCESS",
    "FAILURE",
    "ERROR",
    "UNKNOWN",
    name="status_enum",
    create_type=False,
)


def upgrade():
    op.add_column("pipeline_study_results", sa.Column("run_id", sa.String(), nullable=True))
    op.create_index(
        "ix_pipeline_study_results_run_id", "pipeline_study_results", ["run_id"]
    )
    op.create_unique_constraint(
        "uq_psr__config_run_study",
        "pipeline_study_results",
        ["config_id", "run_id", "base_study_id"],
    )
    op.create_table(
        "pipeline_analysis_results",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("config_id", sa.Text(), nullable=True),
        sa.Column("base_study_id", sa.Text(), nullable=True),
        sa.Column("analysis_id", sa.Text(), nullable=True),
        sa.Column("source_table_analysis", sa.String(), nullable=True),
        sa.Column("result_data", JSONB(), nullable=True),
        sa.Column("status", STATUS_ENUM, nullable=True),
        sa.Column("date_executed", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["config_id"], ["pipeline_configs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["base_study_id"], ["base_studies.id"]),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        # Keys are per paper (table ids like "tbl2" repeat across papers), so
        # the study is part of what makes one unique within a run.
        sa.UniqueConstraint(
            "config_id",
            "base_study_id",
            "source_table_analysis",
            name="uq_par__config_study_source_analysis",
        ),
    )
    _index("pipeline_analysis_results", ["id", "created_at", "updated_at"])
    _index(
        "pipeline_analysis_results",
        ["config_id", "base_study_id", "analysis_id", "source_table_analysis"],
    )
    op.create_index(
        "ix_par__analysis_type",
        "pipeline_analysis_results",
        [sa.text("(result_data -> 'analysis_type')")],
        postgresql_using="gin",
    )

    op.create_table(
        "study_entities",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("base_study_id", sa.Text(), nullable=True),
        sa.Column("entity_class", sa.String(), nullable=True),
        sa.Column("entity_hash", sa.String(64), nullable=False),
        sa.Column("parent_id", sa.Text(), nullable=True),
        sa.Column("identity", JSONB(), nullable=True),
        sa.Column("analysis_id", sa.Text(), nullable=True),
        sa.Column("table_id", sa.Text(), nullable=True),
        sa.Column("first_seen_config_id", sa.Text(), nullable=True),
        sa.Column("last_seen_config_id", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["base_study_id"], ["base_studies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["study_entities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["table_id"], ["tables.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["first_seen_config_id"], ["pipeline_configs.id"]),
        sa.ForeignKeyConstraint(["last_seen_config_id"], ["pipeline_configs.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_hash", name="uq_study_entity__hash"),
    )
    _index("study_entities", ["id", "created_at", "updated_at"])
    _index("study_entities", ["base_study_id", "entity_class"])
    _index("study_entities", ["parent_id"])

    op.create_table(
        "study_entity_aliases",
        sa.Column("entity_hash", sa.String(64), nullable=False),
        sa.Column("entity_id", sa.Text(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("config_id", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["entity_id"], ["study_entities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["config_id"], ["pipeline_configs.id"]),
        sa.PrimaryKeyConstraint("entity_hash"),
    )
    _index("study_entity_aliases", ["entity_id"])

    op.create_table(
        "extraction_entity_links",
        sa.Column("config_id", sa.Text(), nullable=False),
        sa.Column("local_id", sa.String(), nullable=False),
        sa.Column("entity_id", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["config_id"], ["pipeline_configs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["entity_id"], ["study_entities.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("config_id", "local_id"),
    )
    _index("extraction_entity_links", ["entity_id"])

    op.create_table(
        "field_claims",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("entity_id", sa.Text(), nullable=True),
        sa.Column("field_path", sa.String(), nullable=True),
        sa.Column("schema_version", sa.String(), nullable=True),
        sa.Column("value", JSONB(), nullable=True),
        sa.Column("extraction_status", sa.String(), nullable=True),
        sa.Column("value_source", sa.String(), nullable=True),
        sa.Column("value_hash", sa.String(), nullable=True),
        sa.Column("origin", sa.String(), nullable=True),
        sa.Column("origin_user_id", sa.Text(), nullable=True),
        # The claim this one was copied from when a revised parse split or
        # merged its analysis; null for a claim made here directly.
        sa.Column("carried_from", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["entity_id"], ["study_entities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["origin_user_id"], ["users.external_id"]),
        sa.ForeignKeyConstraint(
            ["carried_from"], ["field_claims.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        # The load-bearing constraint: two runs producing the same value for a
        # field produce one claim, not two.
        sa.UniqueConstraint(
            "entity_id", "field_path", "value_hash", name="uq_field_claim__value"
        ),
    )
    _index("field_claims", ["id", "created_at", "updated_at"])
    _index("field_claims", ["entity_id", "value_hash", "origin_user_id", "carried_from"])
    op.create_index(
        "ix_field_claims_entity_field", "field_claims", ["entity_id", "field_path"]
    )

    op.create_table(
        "field_claim_runs",
        sa.Column("claim_id", sa.Text(), nullable=False),
        sa.Column("config_id", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["claim_id"], ["field_claims.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["config_id"], ["pipeline_configs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("claim_id", "config_id"),
    )

    op.create_table(
        "field_claim_evidence",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claim_id", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("spans", JSONB(), nullable=True),
        sa.Column("origin", sa.String(), nullable=True),
        sa.Column("origin_user_id", sa.Text(), nullable=True),
        sa.Column("config_id", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["claim_id"], ["field_claims.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["origin_user_id"], ["users.external_id"]),
        sa.ForeignKeyConstraint(["config_id"], ["pipeline_configs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    _index("field_claim_evidence", ["id", "created_at", "updated_at", "claim_id"])


def downgrade():
    for table in (
        "field_claim_evidence",
        "field_claim_runs",
        "field_claims",
        "extraction_entity_links",
        "study_entity_aliases",
        "study_entities",
        "pipeline_analysis_results",
    ):
        op.drop_table(table)
    op.drop_constraint("uq_psr__config_run_study", "pipeline_study_results", type_="unique")
    op.drop_index("ix_pipeline_study_results_run_id", table_name="pipeline_study_results")
    op.drop_column("pipeline_study_results", "run_id")


def _index(table: str, columns: list[str]) -> None:
    for column in columns:
        op.create_index(f"ix_{table}_{column}", table, [column])
