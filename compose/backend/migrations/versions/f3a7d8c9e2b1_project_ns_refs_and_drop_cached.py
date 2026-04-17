"""migrate projects to neurostore reference FKs, drop cached_* on meta_analyses, and rename annotations column

Adds projects.neurostore_studyset_id / projects.neurostore_annotation_id
(referencing studyset_references / annotation_references). Backfills them from
the legacy projects.studyset_id / projects.annotation_id via
studysets.neurostore_id / annotations.neurostore_id, then drops the legacy
columns.

Also backfills meta_analyses.neurostore_studyset_id /
meta_analyses.neurostore_annotation_id from the legacy cached_studyset_id /
cached_annotation_id, then drops the cached_* columns.

Also renames annotations.cached_studyset_id → annotations.snapshot_studyset_id
to match the current SnapshotAnnotation model.

Revision ID: f3a7d8c9e2b1
Revises: a9d8f7c6b5e4
Create Date: 2026-04-15 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


revision = "f3a7d8c9e2b1"
down_revision = "a9d8f7c6b5e4"
branch_labels = None
depends_on = None


def _fk_names_for(inspector, table, column):
    return [
        fk["name"]
        for fk in inspector.get_foreign_keys(table)
        if column in (fk.get("constrained_columns") or [])
    ]


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── projects: add neurostore_*_id columns ────────────────────────────────
    project_cols = {c["name"] for c in inspector.get_columns("projects")}

    if "neurostore_studyset_id" not in project_cols:
        op.add_column(
            "projects",
            sa.Column("neurostore_studyset_id", sa.Text(), nullable=True),
        )
        op.create_foreign_key(
            "fk_projects_neurostore_studyset_id",
            "projects",
            "studyset_references",
            ["neurostore_studyset_id"],
            ["id"],
        )

    if "neurostore_annotation_id" not in project_cols:
        op.add_column(
            "projects",
            sa.Column("neurostore_annotation_id", sa.Text(), nullable=True),
        )
        op.create_foreign_key(
            "fk_projects_neurostore_annotation_id",
            "projects",
            "annotation_references",
            ["neurostore_annotation_id"],
            ["id"],
        )

    # Re-read columns in case they were just added
    project_cols = {c["name"] for c in inspector.get_columns("projects")}

    # ── projects: backfill from legacy studyset_id / annotation_id ───────────
    if "studyset_id" in project_cols:
        bind.execute(
            sa.text(
                """
                UPDATE projects p
                SET neurostore_studyset_id = s.neurostore_id
                FROM studysets s
                WHERE p.studyset_id = s.id
                  AND p.neurostore_studyset_id IS NULL
                  AND s.neurostore_id IS NOT NULL
                """
            )
        )

    if "annotation_id" in project_cols:
        bind.execute(
            sa.text(
                """
                UPDATE projects p
                SET neurostore_annotation_id = a.neurostore_id
                FROM annotations a
                WHERE p.annotation_id = a.id
                  AND p.neurostore_annotation_id IS NULL
                  AND a.neurostore_id IS NOT NULL
                """
            )
        )

    # ── meta_analyses: backfill from legacy cached_* columns ─────────────────
    meta_cols = {c["name"] for c in inspector.get_columns("meta_analyses")}

    if "cached_studyset_id" in meta_cols:
        bind.execute(
            sa.text(
                """
                UPDATE meta_analyses ma
                SET neurostore_studyset_id = s.neurostore_id
                FROM studysets s
                WHERE ma.cached_studyset_id = s.id
                  AND ma.neurostore_studyset_id IS NULL
                  AND s.neurostore_id IS NOT NULL
                """
            )
        )

    if "cached_annotation_id" in meta_cols:
        bind.execute(
            sa.text(
                """
                UPDATE meta_analyses ma
                SET neurostore_annotation_id = a.neurostore_id
                FROM annotations a
                WHERE ma.cached_annotation_id = a.id
                  AND ma.neurostore_annotation_id IS NULL
                  AND a.neurostore_id IS NOT NULL
                """
            )
        )

    # ── projects: drop legacy studyset_id / annotation_id ────────────────────
    if "studyset_id" in project_cols:
        for fk_name in _fk_names_for(inspector, "projects", "studyset_id"):
            op.drop_constraint(fk_name, "projects", type_="foreignkey")
        op.drop_column("projects", "studyset_id")

    if "annotation_id" in project_cols:
        for fk_name in _fk_names_for(inspector, "projects", "annotation_id"):
            op.drop_constraint(fk_name, "projects", type_="foreignkey")
        op.drop_column("projects", "annotation_id")

    # ── meta_analyses: drop legacy cached_* columns ──────────────────────────
    if "cached_studyset_id" in meta_cols:
        for fk_name in _fk_names_for(inspector, "meta_analyses", "cached_studyset_id"):
            op.drop_constraint(fk_name, "meta_analyses", type_="foreignkey")
        op.drop_column("meta_analyses", "cached_studyset_id")

    if "cached_annotation_id" in meta_cols:
        for fk_name in _fk_names_for(inspector, "meta_analyses", "cached_annotation_id"):
            op.drop_constraint(fk_name, "meta_analyses", type_="foreignkey")
        op.drop_column("meta_analyses", "cached_annotation_id")

    # ── annotations: rename cached_studyset_id → snapshot_studyset_id ────────
    # Re-read column list after all drops above.
    ann_cols = {c["name"] for c in inspector.get_columns("annotations")}

    if "cached_studyset_id" in ann_cols and "snapshot_studyset_id" not in ann_cols:
        for fk_name in _fk_names_for(inspector, "annotations", "cached_studyset_id"):
            op.drop_constraint(fk_name, "annotations", type_="foreignkey")
        op.alter_column("annotations", "cached_studyset_id", new_column_name="snapshot_studyset_id")
        op.create_foreign_key(
            "fk_annotations_snapshot_studyset_id",
            "annotations",
            "studysets",
            ["snapshot_studyset_id"],
            ["id"],
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── meta_analyses: restore cached_* columns ──────────────────────────────
    meta_cols = {c["name"] for c in inspector.get_columns("meta_analyses")}

    if "cached_studyset_id" not in meta_cols:
        op.add_column(
            "meta_analyses",
            sa.Column("cached_studyset_id", sa.Text(), nullable=True),
        )
        op.create_foreign_key(
            "fk_meta_analyses_cached_studyset_id",
            "meta_analyses",
            "studysets",
            ["cached_studyset_id"],
            ["id"],
        )

    if "cached_annotation_id" not in meta_cols:
        op.add_column(
            "meta_analyses",
            sa.Column("cached_annotation_id", sa.Text(), nullable=True),
        )
        op.create_foreign_key(
            "fk_meta_analyses_cached_annotation_id",
            "meta_analyses",
            "annotations",
            ["cached_annotation_id"],
            ["id"],
        )

    # Best-effort: pick any studyset/annotation whose neurostore_id matches.
    # Duplicates are possible, so use a subquery with LIMIT 1.
    bind.execute(
        sa.text(
            """
            UPDATE meta_analyses ma
            SET cached_studyset_id = (
                SELECT s.id FROM studysets s
                WHERE s.neurostore_id = ma.neurostore_studyset_id
                ORDER BY s.id LIMIT 1
            )
            WHERE ma.cached_studyset_id IS NULL
              AND ma.neurostore_studyset_id IS NOT NULL
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE meta_analyses ma
            SET cached_annotation_id = (
                SELECT a.id FROM annotations a
                WHERE a.neurostore_id = ma.neurostore_annotation_id
                ORDER BY a.id LIMIT 1
            )
            WHERE ma.cached_annotation_id IS NULL
              AND ma.neurostore_annotation_id IS NOT NULL
            """
        )
    )

    # ── projects: restore studyset_id / annotation_id ────────────────────────
    project_cols = {c["name"] for c in inspector.get_columns("projects")}

    if "studyset_id" not in project_cols:
        op.add_column(
            "projects",
            sa.Column("studyset_id", sa.Text(), nullable=True),
        )
        op.create_foreign_key(
            "fk_projects_studyset_id",
            "projects",
            "studysets",
            ["studyset_id"],
            ["id"],
        )

    if "annotation_id" not in project_cols:
        op.add_column(
            "projects",
            sa.Column("annotation_id", sa.Text(), nullable=True),
        )
        op.create_foreign_key(
            "fk_projects_annotation_id",
            "projects",
            "annotations",
            ["annotation_id"],
            ["id"],
        )

    bind.execute(
        sa.text(
            """
            UPDATE projects p
            SET studyset_id = (
                SELECT s.id FROM studysets s
                WHERE s.neurostore_id = p.neurostore_studyset_id
                ORDER BY s.id LIMIT 1
            )
            WHERE p.studyset_id IS NULL
              AND p.neurostore_studyset_id IS NOT NULL
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE projects p
            SET annotation_id = (
                SELECT a.id FROM annotations a
                WHERE a.neurostore_id = p.neurostore_annotation_id
                ORDER BY a.id LIMIT 1
            )
            WHERE p.annotation_id IS NULL
              AND p.neurostore_annotation_id IS NOT NULL
            """
        )
    )

    # Drop the new neurostore_*_id columns
    inspector = sa.inspect(bind)
    project_cols = {c["name"] for c in inspector.get_columns("projects")}

    if "neurostore_studyset_id" in project_cols:
        for fk_name in _fk_names_for(inspector, "projects", "neurostore_studyset_id"):
            op.drop_constraint(fk_name, "projects", type_="foreignkey")
        op.drop_column("projects", "neurostore_studyset_id")

    if "neurostore_annotation_id" in project_cols:
        for fk_name in _fk_names_for(inspector, "projects", "neurostore_annotation_id"):
            op.drop_constraint(fk_name, "projects", type_="foreignkey")
        op.drop_column("projects", "neurostore_annotation_id")

    # ── annotations: rename snapshot_studyset_id → cached_studyset_id ────────
    ann_cols = {c["name"] for c in inspector.get_columns("annotations")}

    if "snapshot_studyset_id" in ann_cols and "cached_studyset_id" not in ann_cols:
        for fk_name in _fk_names_for(inspector, "annotations", "snapshot_studyset_id"):
            op.drop_constraint(fk_name, "annotations", type_="foreignkey")
        op.alter_column("annotations", "snapshot_studyset_id", new_column_name="cached_studyset_id")
        op.create_foreign_key(
            None,
            "annotations",
            "studysets",
            ["cached_studyset_id"],
            ["id"],
        )
