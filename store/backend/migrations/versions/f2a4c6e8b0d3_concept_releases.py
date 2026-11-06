"""concept_releases, concepts and concept_ancestors; analysis_features.vocabulary_releases

Revision ID: f2a4c6e8b0d3
Revises: e1f3a5c7b9d2
Create Date: 2026-11-06

Empty until `manage load-concept-ancestors` loads the releases study_schema's manifest
pins; feature rows take their medical-condition ancestors from them at the next backfill.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "f2a4c6e8b0d3"
down_revision = "e1f3a5c7b9d2"
branch_labels = None
depends_on = None


def _vocabulary():
    return sa.Column(
        "vocabulary",
        sa.Text(),
        sa.ForeignKey("concept_releases.vocabulary", ondelete="CASCADE"),
        nullable=False,
    )


def upgrade():
    op.create_table(
        "concept_releases",
        sa.Column("vocabulary", sa.Text(), nullable=False),
        sa.Column("release", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("sha256", sa.Text(), nullable=False),
        sa.Column("concepts", sa.Integer(), nullable=False),
        sa.Column(
            "loaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("vocabulary"),
    )
    op.create_table(
        "concepts",
        sa.Column("concept_id", sa.Text(), nullable=False),
        _vocabulary(),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("synonyms", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("concept_id"),
    )
    op.create_index(op.f("ix_concepts_vocabulary"), "concepts", ["vocabulary"])
    op.create_table(
        "concept_ancestors",
        sa.Column("concept_id", sa.Text(), nullable=False),
        sa.Column("ancestor_id", sa.Text(), nullable=False),
        _vocabulary(),
        sa.Column("distance", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("concept_id", "ancestor_id"),
    )
    op.create_index(
        op.f("ix_concept_ancestors_vocabulary"), "concept_ancestors", ["vocabulary"]
    )
    op.add_column(
        "analysis_features",
        sa.Column("vocabulary_releases", postgresql.ARRAY(sa.Text()), nullable=True),
    )


def downgrade():
    op.drop_column("analysis_features", "vocabulary_releases")
    op.drop_table("concept_ancestors")
    op.drop_table("concepts")
    op.drop_table("concept_releases")
