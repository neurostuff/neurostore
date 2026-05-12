"""add study-owned images

Revision ID: a6d7e8f9a0b1
Revises: 3aa4c1f2b5d7
Create Date: 2026-05-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a6d7e8f9a0b1"
down_revision = "3aa4c1f2b5d7"
branch_labels = None
depends_on = None


def _has_fk(inspector, table, name):
    return any(fk["name"] == name for fk in inspector.get_foreign_keys(table))


def _has_index(inspector, table, name):
    return any(index["name"] == name for index in inspector.get_indexes(table))


def _recompute_study_image_flags():
    # Only touch studies that have images now OR previously had image flags set.
    # On production data (176K studies, 1.6K with images) this cuts update time
    # from ~47s (full table lock) to ~2s.
    op.execute(
        """
        UPDATE studies AS s
        SET
            has_images = EXISTS (
                SELECT 1 FROM images AS i
                WHERE i.study_id = s.id
            ),
            has_z_maps = EXISTS (
                SELECT 1 FROM images AS i
                WHERE i.study_id = s.id AND i.value_type IN ('Z')
            ),
            has_t_maps = EXISTS (
                SELECT 1 FROM images AS i
                WHERE i.study_id = s.id AND i.value_type IN ('T')
            ),
            has_beta_and_variance_maps = (
                EXISTS (
                    SELECT 1 FROM images AS i
                    WHERE i.study_id = s.id AND i.value_type IN ('M', 'U')
                )
                AND EXISTS (
                    SELECT 1 FROM images AS i
                    WHERE i.study_id = s.id AND i.value_type IN ('V')
                )
            )
        WHERE s.id IN (
            SELECT study_id FROM images WHERE study_id IS NOT NULL
            UNION
            SELECT id FROM studies
            WHERE has_images IS TRUE
               OR has_z_maps IS TRUE
               OR has_t_maps IS TRUE
               OR has_beta_and_variance_maps IS TRUE
        )
        """
    )
    op.execute(
        """
        UPDATE base_studies AS bs
        SET
            has_images = EXISTS (
                SELECT 1 FROM studies AS s
                WHERE s.base_study_id = bs.id AND s.has_images IS TRUE
            ),
            has_z_maps = EXISTS (
                SELECT 1 FROM studies AS s
                WHERE s.base_study_id = bs.id AND s.has_z_maps IS TRUE
            ),
            has_t_maps = EXISTS (
                SELECT 1 FROM studies AS s
                WHERE s.base_study_id = bs.id AND s.has_t_maps IS TRUE
            ),
            has_beta_and_variance_maps = EXISTS (
                SELECT 1 FROM studies AS s
                WHERE
                    s.base_study_id = bs.id
                    AND s.has_beta_and_variance_maps IS TRUE
            )
        WHERE bs.id IN (
            SELECT DISTINCT s.base_study_id FROM studies AS s
            WHERE s.base_study_id IS NOT NULL
              AND s.id IN (
                  SELECT study_id FROM images WHERE study_id IS NOT NULL
                  UNION
                  SELECT id FROM studies
                  WHERE has_images IS TRUE
                     OR has_z_maps IS TRUE
                     OR has_t_maps IS TRUE
                     OR has_beta_and_variance_maps IS TRUE
              )
        )
        """
    )


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    op.add_column("images", sa.Column("study_id", sa.Text(), nullable=True))
    op.execute(
        """
        UPDATE images AS i
        SET study_id = a.study_id
        FROM analyses AS a
        WHERE i.analysis_id = a.id AND i.study_id IS NULL
        """
    )
    op.create_index(op.f("ix_images_study_id"), "images", ["study_id"], unique=False)
    op.create_foreign_key(
        "images_study_id_fkey",
        "images",
        "studies",
        ["study_id"],
        ["id"],
        ondelete="CASCADE",
    )

    if _has_fk(inspector, "images", "images_analysis_id_fkey"):
        op.drop_constraint("images_analysis_id_fkey", "images", type_="foreignkey")
    op.create_foreign_key(
        "images_analysis_id_fkey",
        "images",
        "analyses",
        ["analysis_id"],
        ["id"],
        ondelete="SET NULL",
    )

    _recompute_study_image_flags()


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_fk(inspector, "images", "images_analysis_id_fkey"):
        op.drop_constraint("images_analysis_id_fkey", "images", type_="foreignkey")
    op.create_foreign_key(
        "images_analysis_id_fkey",
        "images",
        "analyses",
        ["analysis_id"],
        ["id"],
        ondelete="CASCADE",
    )

    if _has_fk(inspector, "images", "images_study_id_fkey"):
        op.drop_constraint("images_study_id_fkey", "images", type_="foreignkey")
    if _has_index(inspector, "images", op.f("ix_images_study_id")):
        op.drop_index(op.f("ix_images_study_id"), table_name="images")
    op.drop_column("images", "study_id")
