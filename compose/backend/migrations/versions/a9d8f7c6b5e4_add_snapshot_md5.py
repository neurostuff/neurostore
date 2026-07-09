"""add snapshot md5 columns

Revision ID: a9d8f7c6b5e4
Revises: b4a1e6b9f2c1
Create Date: 2026-04-14 00:00:00.000000

"""

import hashlib
import json

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a9d8f7c6b5e4"
down_revision = "b4a1e6b9f2c1"
branch_labels = None
depends_on = None


def _md5_of_snapshot(obj):
    s = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.md5(s.encode("utf-8")).hexdigest()


BATCH_SIZE = 500


def _backfill_md5(bind, table_name, batch_size=BATCH_SIZE):
    """Compute and store md5 for rows in *table_name* with snapshot but null md5.

    This processes rows in batches to avoid loading the entire table into memory.
    """
    while True:
        rows = bind.execute(
            sa.text(
                f"SELECT id, snapshot FROM {table_name} WHERE snapshot IS NOT NULL AND (md5 IS NULL OR md5 = '') ORDER BY id LIMIT :limit"
            ),
            {"limit": batch_size},
        ).fetchall()
        if not rows:
            break
        for row_id, snapshot in rows:
            if snapshot is None:
                continue
            md5 = _md5_of_snapshot(snapshot)
            bind.execute(
                sa.text(
                    f"UPDATE {table_name} SET md5 = :md5 WHERE id = :id AND (md5 IS NULL OR md5 = '')"
                ),
                {"md5": md5, "id": row_id},
            )


def _dedup_table(bind, table_name, fk_references=None, batch_size=BATCH_SIZE):
    """Remove duplicate rows (same md5) from *table_name* in batches.

    This discovers all foreign keys that reference *table_name* and updates
    referencing rows to point to the canonical row before deleting duplicates.
    The optional *fk_references* list can be supplied to prefer an explicit
    ordering, but discovery is used to ensure no referencing table is missed.
    """

    # discover referencing FKs: (child_table, child_column)
    try:
        ref_rows = bind.execute(
            sa.text(
                "SELECT tc.table_name AS child_table, kcu.column_name AS child_column "
                "FROM information_schema.table_constraints tc "
                "JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name "
                "JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name "
                "WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = :tbl"
            ),
            {"tbl": table_name},
        ).fetchall()
        discovered_fks = {(r[0], r[1]) for r in ref_rows}
    except Exception:
        discovered_fks = set()

    explicit_fks = set(fk_references or [])
    fk_set = list(explicit_fks.union(discovered_fks))

    # Process md5 groups in repeat-until-empty batches
    while True:
        groups = bind.execute(
            sa.text(
                f"SELECT md5 FROM {table_name} WHERE md5 IS NOT NULL GROUP BY md5 HAVING COUNT(*) > 1 ORDER BY md5 LIMIT :limit"
            ),
            {"limit": batch_size},
        ).fetchall()
        if not groups:
            break

        made_progress = False
        for (md5,) in groups:
            ids = bind.execute(
                sa.text(f"SELECT id FROM {table_name} WHERE md5 = :md5 ORDER BY id"),
                {"md5": md5},
            ).fetchall()
            ids = [r[0] for r in ids]
            if len(ids) <= 1:
                continue
            canonical_id = ids[0]
            duplicate_ids = ids[1:]

            # Redirect all discovered FK references to the canonical id
            for child_table, child_col in fk_set:
                # verify child_col exists on child_table
                try:
                    cols = {
                        c[0]
                        for c in bind.execute(
                            sa.text(
                                "SELECT column_name FROM information_schema.columns WHERE table_name = :t"
                            ),
                            {"t": child_table},
                        ).fetchall()
                    }
                except Exception:
                    cols = set()
                if child_col not in cols:
                    continue

                for dup_id in duplicate_ids:
                    bind.execute(
                        sa.text(
                            f"UPDATE {child_table} SET {child_col} = :canonical WHERE {child_col} = :dup"
                        ),
                        {"canonical": canonical_id, "dup": dup_id},
                    )

            # Now safe to delete duplicates
            for dup_id in duplicate_ids:
                bind.execute(
                    sa.text(f"DELETE FROM {table_name} WHERE id = :id"), {"id": dup_id}
                )
            made_progress = True

        if not made_progress:
            break


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── studysets ────────────────────────────────────────────────────────────
    ss_cols = {c["name"] for c in inspector.get_columns("studysets")}
    if "md5" not in ss_cols:
        op.add_column("studysets", sa.Column("md5", sa.Text(), nullable=True))

    _backfill_md5(bind, "studysets")

    _dedup_table(
        bind,
        "studysets",
        fk_references=[
            ("meta_analyses", "cached_studyset_id"),
            ("annotations", "cached_studyset_id"),
            ("projects", "studyset_id"),
        ],
    )

    ss_indexes = {idx["name"] for idx in inspector.get_indexes("studysets")}
    if "ix_studysets_md5" not in ss_indexes:
        op.create_index("ix_studysets_md5", "studysets", ["md5"], unique=True)
    else:
        # Recreate as unique if it was previously created as non-unique
        op.drop_index("ix_studysets_md5", table_name="studysets")
        op.create_index("ix_studysets_md5", "studysets", ["md5"], unique=True)

    # ── annotations ──────────────────────────────────────────────────────────
    ann_cols = {c["name"] for c in inspector.get_columns("annotations")}
    if "md5" not in ann_cols:
        op.add_column("annotations", sa.Column("md5", sa.Text(), nullable=True))

    _backfill_md5(bind, "annotations")

    _dedup_table(
        bind,
        "annotations",
        fk_references=[
            ("meta_analyses", "cached_annotation_id"),
            ("projects", "annotation_id"),
        ],
    )

    ann_indexes = {idx["name"] for idx in inspector.get_indexes("annotations")}
    if "ix_annotations_md5" not in ann_indexes:
        op.create_index("ix_annotations_md5", "annotations", ["md5"], unique=True)
    else:
        op.drop_index("ix_annotations_md5", table_name="annotations")
        op.create_index("ix_annotations_md5", "annotations", ["md5"], unique=True)

    # ── meta_analysis_results snapshot FKs ───────────────────────────────────
    mar_cols = {c["name"] for c in inspector.get_columns("meta_analysis_results")}
    if "studyset_snapshot_id" not in mar_cols:
        op.add_column(
            "meta_analysis_results",
            sa.Column("studyset_snapshot_id", sa.Text(), nullable=True),
        )
        op.create_foreign_key(
            "fk_meta_analysis_results_studyset_snapshot_id",
            "meta_analysis_results",
            "studysets",
            ["studyset_snapshot_id"],
            ["id"],
        )
    if "annotation_snapshot_id" not in mar_cols:
        op.add_column(
            "meta_analysis_results",
            sa.Column("annotation_snapshot_id", sa.Text(), nullable=True),
        )
        op.create_foreign_key(
            "fk_meta_analysis_results_annotation_snapshot_id",
            "meta_analysis_results",
            "annotations",
            ["annotation_snapshot_id"],
            ["id"],
        )

    # Backfill snapshot FKs from the parent meta-analysis cached_* columns.
    bind.execute(
        sa.text(
            """
            UPDATE meta_analysis_results mar
            SET studyset_snapshot_id = ma.cached_studyset_id
            FROM meta_analyses ma
            WHERE mar.meta_analysis_id = ma.id
              AND mar.studyset_snapshot_id IS NULL
              AND ma.cached_studyset_id IS NOT NULL
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE meta_analysis_results mar
            SET annotation_snapshot_id = ma.cached_annotation_id
            FROM meta_analyses ma
            WHERE mar.meta_analysis_id = ma.id
              AND mar.annotation_snapshot_id IS NULL
              AND ma.cached_annotation_id IS NOT NULL
            """
        )
    )

    # Drop legacy meta_analyses.snapshots column if a previous run of this
    # migration created it before the schema was reworked.
    ma_cols = {c["name"] for c in inspector.get_columns("meta_analyses")}
    if "snapshots" in ma_cols:
        op.drop_column("meta_analyses", "snapshots")


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    mar_cols = {c["name"] for c in inspector.get_columns("meta_analysis_results")}
    mar_fks = {fk["name"] for fk in inspector.get_foreign_keys("meta_analysis_results")}
    if "studyset_snapshot_id" in mar_cols:
        if "fk_meta_analysis_results_studyset_snapshot_id" in mar_fks:
            op.drop_constraint(
                "fk_meta_analysis_results_studyset_snapshot_id",
                "meta_analysis_results",
                type_="foreignkey",
            )
        op.drop_column("meta_analysis_results", "studyset_snapshot_id")
    if "annotation_snapshot_id" in mar_cols:
        if "fk_meta_analysis_results_annotation_snapshot_id" in mar_fks:
            op.drop_constraint(
                "fk_meta_analysis_results_annotation_snapshot_id",
                "meta_analysis_results",
                type_="foreignkey",
            )
        op.drop_column("meta_analysis_results", "annotation_snapshot_id")

    ann_cols = {c["name"] for c in inspector.get_columns("annotations")}
    if "md5" in ann_cols:
        ann_indexes = {idx["name"] for idx in inspector.get_indexes("annotations")}
        if "ix_annotations_md5" in ann_indexes:
            op.drop_index("ix_annotations_md5", table_name="annotations")
        op.drop_column("annotations", "md5")

    ss_cols = {c["name"] for c in inspector.get_columns("studysets")}
    if "md5" in ss_cols:
        ss_indexes = {idx["name"] for idx in inspector.get_indexes("studysets")}
        if "ix_studysets_md5" in ss_indexes:
            op.drop_index("ix_studysets_md5", table_name="studysets")
        op.drop_column("studysets", "md5")
