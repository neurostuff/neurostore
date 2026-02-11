"""add async media flags outbox and study/analysis flags

Revision ID: c1e2f3a4b5c6
Revises: b7c8d9e0f1a2
Create Date: 2026-02-10 12:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import expression


# revision identifiers, used by Alembic.
revision = "c1e2f3a4b5c6"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "analyses",
        sa.Column(
            "has_coordinates",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "analyses",
        sa.Column(
            "has_images",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "analyses",
        sa.Column(
            "has_z_maps",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "analyses",
        sa.Column(
            "has_t_maps",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "analyses",
        sa.Column(
            "has_beta_and_variance_maps",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "studies",
        sa.Column(
            "has_coordinates",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "studies",
        sa.Column(
            "has_z_maps",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "studies",
        sa.Column(
            "has_t_maps",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "studies",
        sa.Column(
            "has_beta_and_variance_maps",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "base_studies",
        sa.Column(
            "has_z_maps",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "base_studies",
        sa.Column(
            "has_t_maps",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "base_studies",
        sa.Column(
            "has_beta_and_variance_maps",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )
    op.add_column(
        "studies",
        sa.Column(
            "has_images",
            sa.Boolean(),
            nullable=False,
            server_default=expression.false(),
        ),
    )

    op.create_table(
        "base_study_flag_outbox",
        sa.Column("base_study_id", sa.Text(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column(
            "enqueued_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["base_study_id"], ["base_studies.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("base_study_id"),
    )
    op.create_index(
        op.f("ix_base_study_flag_outbox_enqueued_at"),
        "base_study_flag_outbox",
        ["enqueued_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_base_study_flag_outbox_updated_at"),
        "base_study_flag_outbox",
        ["updated_at"],
        unique=False,
    )

    # Backfill analysis-level flags
    op.execute(
        """
        UPDATE analyses AS a
        SET
            has_coordinates = EXISTS (
                SELECT 1
                FROM points AS p
                WHERE p.analysis_id = a.id
            ),
            has_images = EXISTS (
                SELECT 1
                FROM images AS i
                WHERE i.analysis_id = a.id
            ),
            has_z_maps = EXISTS (
                SELECT 1
                FROM images AS i
                WHERE i.analysis_id = a.id
                  AND lower(btrim(coalesce(i.value_type, ''))) IN ('z', 'z map')
            ),
            has_t_maps = EXISTS (
                SELECT 1
                FROM images AS i
                WHERE i.analysis_id = a.id
                  AND lower(btrim(coalesce(i.value_type, ''))) IN ('t', 't map')
            ),
            has_beta_and_variance_maps = (
                EXISTS (
                    SELECT 1
                    FROM images AS i
                    WHERE i.analysis_id = a.id
                      AND lower(btrim(coalesce(i.value_type, ''))) IN (
                          'u', 'm', 'u map', 'm map', 'beta', 'beta map',
                          'univariate-beta map', 'multivariate-beta map',
                          'univariate beta map', 'multivariate beta map'
                      )
                )
                AND EXISTS (
                    SELECT 1
                    FROM images AS i
                    WHERE i.analysis_id = a.id
                      AND lower(btrim(coalesce(i.value_type, ''))) IN (
                          'v', 'v map', 'variance', 'variance map'
                      )
                )
            )
        """
    )

    # Backfill study-level flags
    op.execute(
        """
        UPDATE studies AS s
        SET
            has_coordinates = EXISTS (
                SELECT 1
                FROM analyses AS a
                JOIN points AS p ON p.analysis_id = a.id
                WHERE a.study_id = s.id
            ),
            has_images = EXISTS (
                SELECT 1
                FROM analyses AS a
                JOIN images AS i ON i.analysis_id = a.id
                WHERE a.study_id = s.id
            ),
            has_z_maps = EXISTS (
                SELECT 1
                FROM analyses AS a
                JOIN images AS i ON i.analysis_id = a.id
                WHERE a.study_id = s.id
                  AND lower(btrim(coalesce(i.value_type, ''))) IN ('z', 'z map')
            ),
            has_t_maps = EXISTS (
                SELECT 1
                FROM analyses AS a
                JOIN images AS i ON i.analysis_id = a.id
                WHERE a.study_id = s.id
                  AND lower(btrim(coalesce(i.value_type, ''))) IN ('t', 't map')
            ),
            has_beta_and_variance_maps = (
                EXISTS (
                    SELECT 1
                    FROM analyses AS a
                    JOIN images AS i ON i.analysis_id = a.id
                    WHERE a.study_id = s.id
                      AND lower(btrim(coalesce(i.value_type, ''))) IN (
                          'u', 'm', 'u map', 'm map', 'beta', 'beta map',
                          'univariate-beta map', 'multivariate-beta map',
                          'univariate beta map', 'multivariate beta map'
                      )
                )
                AND EXISTS (
                    SELECT 1
                    FROM analyses AS a
                    JOIN images AS i ON i.analysis_id = a.id
                    WHERE a.study_id = s.id
                      AND lower(btrim(coalesce(i.value_type, ''))) IN (
                          'v', 'v map', 'variance', 'variance map'
                      )
                )
            )
        """
    )

    # Recompute base-study flags in case of historical drift
    op.execute(
        """
        UPDATE base_studies AS bs
        SET
            has_coordinates = EXISTS (
                SELECT 1
                FROM studies AS s
                JOIN analyses AS a ON a.study_id = s.id
                JOIN points AS p ON p.analysis_id = a.id
                WHERE s.base_study_id = bs.id
            ),
            has_images = EXISTS (
                SELECT 1
                FROM studies AS s
                JOIN analyses AS a ON a.study_id = s.id
                JOIN images AS i ON i.analysis_id = a.id
                WHERE s.base_study_id = bs.id
            ),
            has_z_maps = EXISTS (
                SELECT 1
                FROM studies AS s
                JOIN analyses AS a ON a.study_id = s.id
                JOIN images AS i ON i.analysis_id = a.id
                WHERE s.base_study_id = bs.id
                  AND lower(btrim(coalesce(i.value_type, ''))) IN ('z', 'z map')
            ),
            has_t_maps = EXISTS (
                SELECT 1
                FROM studies AS s
                JOIN analyses AS a ON a.study_id = s.id
                JOIN images AS i ON i.analysis_id = a.id
                WHERE s.base_study_id = bs.id
                  AND lower(btrim(coalesce(i.value_type, ''))) IN ('t', 't map')
            ),
            has_beta_and_variance_maps = (
                EXISTS (
                    SELECT 1
                    FROM studies AS s
                    JOIN analyses AS a ON a.study_id = s.id
                    JOIN images AS i ON i.analysis_id = a.id
                    WHERE s.base_study_id = bs.id
                      AND lower(btrim(coalesce(i.value_type, ''))) IN (
                          'u', 'm', 'u map', 'm map', 'beta', 'beta map',
                          'univariate-beta map', 'multivariate-beta map',
                          'univariate beta map', 'multivariate beta map'
                      )
                )
                AND EXISTS (
                    SELECT 1
                    FROM studies AS s
                    JOIN analyses AS a ON a.study_id = s.id
                    JOIN images AS i ON i.analysis_id = a.id
                    WHERE s.base_study_id = bs.id
                      AND lower(btrim(coalesce(i.value_type, ''))) IN (
                          'v', 'v map', 'variance', 'variance map'
                      )
                )
            )
        """
    )

    # Build the partial index concurrently to avoid long write blocking.
    with op.get_context().autocommit_block():
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS
            ix_base_studies_has_images_true_created_at_id
            ON base_studies (created_at, id)
            WHERE has_images IS TRUE AND is_active IS TRUE
            """
        )
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS
            ix_base_studies_has_z_maps_true_created_at_id
            ON base_studies (created_at, id)
            WHERE has_z_maps IS TRUE AND is_active IS TRUE
            """
        )
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS
            ix_base_studies_has_t_maps_true_created_at_id
            ON base_studies (created_at, id)
            WHERE has_t_maps IS TRUE AND is_active IS TRUE
            """
        )
        op.execute(
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS
            ix_base_studies_has_beta_variance_true_created_at_id
            ON base_studies (created_at, id)
            WHERE has_beta_and_variance_maps IS TRUE AND is_active IS TRUE
            """
        )


def downgrade():
    with op.get_context().autocommit_block():
        op.execute(
            """
            DROP INDEX CONCURRENTLY IF EXISTS
            ix_base_studies_has_beta_variance_true_created_at_id
            """
        )
        op.execute(
            """
            DROP INDEX CONCURRENTLY IF EXISTS
            ix_base_studies_has_t_maps_true_created_at_id
            """
        )
        op.execute(
            """
            DROP INDEX CONCURRENTLY IF EXISTS
            ix_base_studies_has_z_maps_true_created_at_id
            """
        )
        op.execute(
            """
            DROP INDEX CONCURRENTLY IF EXISTS
            ix_base_studies_has_images_true_created_at_id
            """
        )

    op.drop_index(
        op.f("ix_base_study_flag_outbox_updated_at"),
        table_name="base_study_flag_outbox",
    )
    op.drop_index(
        op.f("ix_base_study_flag_outbox_enqueued_at"),
        table_name="base_study_flag_outbox",
    )
    op.drop_table("base_study_flag_outbox")

    op.drop_column("base_studies", "has_beta_and_variance_maps")
    op.drop_column("base_studies", "has_t_maps")
    op.drop_column("base_studies", "has_z_maps")
    op.drop_column("studies", "has_beta_and_variance_maps")
    op.drop_column("studies", "has_t_maps")
    op.drop_column("studies", "has_z_maps")
    op.drop_column("studies", "has_images")
    op.drop_column("studies", "has_coordinates")
    op.drop_column("analyses", "has_beta_and_variance_maps")
    op.drop_column("analyses", "has_t_maps")
    op.drop_column("analyses", "has_z_maps")
    op.drop_column("analyses", "has_images")
    op.drop_column("analyses", "has_coordinates")
