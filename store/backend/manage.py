"""
    Command line management tools.
"""

import os

import click
from flask_migrate import Migrate

from neurostore.core import app, db
from neurostore import ingest
from neurostore import models
from collections import OrderedDict

if not getattr(app, "config", None):
    app = app._app

app.config.from_object(os.environ["APP_SETTINGS"])


def include_object(obj, name, type_, reflected, compare_to):
    # Skip partitions/objects created on the fly for vector embeddings; Alembic must ignore them.
    if type_ == "table" and name.startswith("pipeline_embeddings_"):
        return False
    if (
        type_ in {"index", "constraint"}
        and name.startswith("pe_")
        and (name.endswith("_hnsw") or name.endswith("_dims_chk"))
    ):
        return False
    return True


migrate = Migrate(
    app,
    db,
    directory=app.config["MIGRATIONS_DIR"],
    include_object=include_object,
)
migrate.init_app(app, db)


@app.shell_context_processor
def make_shell_context():
    return dict(app=app, db=db, ms=models)


@app.cli.command()
@click.option("--max-rows", default=None, help="ingest neurosynth")
def ingest_neurosynth(max_rows):
    if max_rows is not None:
        max_rows = int(max_rows)
    ingest.ingest_neurosynth(max_rows=max_rows)


@app.cli.command()
@click.option(
    "--verbose/-v", default=False, help="increase verbosity downloading neurovault"
)
@click.option(
    "--limit/-l", default=None, help="number of neurovault studies to download"
)
def ingest_neurovault(verbose, limit):
    if limit is not None:
        limit = int(limit)
    ingest.ingest_neurovault(verbose=verbose, limit=limit)


@app.cli.command()
@click.option("--max-rows", default=None, help="ingest neurosynth")
def ingest_neuroquery(max_rows):
    if max_rows is not None:
        max_rows = int(max_rows)
    ingest.ingest_neuroquery(max_rows=max_rows)


@app.cli.command("backfill-note-keys")
@click.option("--limit", default=None, type=int, help="limit number of annotations to process")
@click.option("--dry-run", is_flag=True, help="do not persist changes")
def backfill_note_keys(limit, dry_run):
    """Infer missing note_keys from existing annotation notes.

    We target annotations whose note_keys is null/empty, collect all keys present
    in their annotation_analyses.note payloads, assign order by first appearance,
    and infer type from the first non-null sample (defaulting to string).
    """
    updated = 0
    checked = 0

    conn = db.session.connection()
    ids_sql = """
        SELECT id
        FROM annotations
        WHERE note_keys IS NULL OR note_keys = '{}'::jsonb
        ORDER BY created_at
    """
    if limit:
        ids_sql += " LIMIT :limit"
    ids = [row.id for row in conn.execute(sa.text(ids_sql), {"limit": limit} if limit else {})]

    for annot_id in ids:
        checked += 1
        notes = conn.execute(
            sa.text("SELECT note FROM annotation_analyses WHERE annotation_id = :id"),
            {"id": annot_id},
        ).fetchall()

        inferred: OrderedDict[str, dict] = OrderedDict()

        # First pass: record all keys in order of first appearance across notes
        for row in notes:
            note = row.note or {}
            if not isinstance(note, dict):
                continue
            for key in note.keys():
                if key not in inferred:
                    inferred[key] = {"type": None, "order": len(inferred)}

        # Second pass: find first non-null sample for each key to determine type
        for row in notes:
            note = row.note or {}
            if not isinstance(note, dict):
                continue
            for key, value in note.items():
                if key not in inferred or inferred[key]["type"] is not None:
                    continue
                if value is None:
                    continue
                if isinstance(value, bool):
                    inferred[key]["type"] = "boolean"
                elif isinstance(value, (int, float)) and not isinstance(value, bool):
                    inferred[key]["type"] = "number"
                else:
                    inferred[key]["type"] = "string"

        # Default any keys that never had a non-null sample to string
        for key, descriptor in inferred.items():
            if descriptor["type"] is None:
                descriptor["type"] = "string"

        if inferred:
            updated += 1
            if not dry_run:
                conn.execute(
                    sa.text("UPDATE annotations SET note_keys = :note_keys WHERE id = :id"),
                    {"id": annot_id, "note_keys": inferred},
                )

    if updated and not dry_run:
        db.session.commit()

    click.echo(f"Checked {checked} annotations; updated {updated} (dry_run={dry_run}).")
