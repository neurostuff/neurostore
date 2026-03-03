"""backfill note key defaults

Revision ID: 9c9f3aa4b5d1
Revises: f3a4b5c6d7e8
Create Date: 2026-03-03 00:00:00.000000
"""

from copy import deepcopy

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "9c9f3aa4b5d1"
down_revision = "f3a4b5c6d7e8"
branch_labels = None
depends_on = None


def _implicit_default(key, note_type):
    if note_type == "boolean":
        return key == "included"
    if note_type in {"string", "number"}:
        return None
    return None


def _backfill_note_key_defaults(note_keys):
    if not isinstance(note_keys, dict):
        return None

    updated = deepcopy(note_keys)
    changed = False

    for key, descriptor in updated.items():
        if not isinstance(descriptor, dict):
            continue
        if "default" in descriptor:
            continue
        descriptor["default"] = _implicit_default(key, descriptor.get("type"))
        updated[key] = descriptor
        changed = True

    if not changed:
        return None
    return updated


def _remove_note_key_defaults(note_keys):
    if not isinstance(note_keys, dict):
        return None

    updated = deepcopy(note_keys)
    changed = False

    for key, descriptor in updated.items():
        if not isinstance(descriptor, dict) or "default" not in descriptor:
            continue
        descriptor.pop("default", None)
        updated[key] = descriptor
        changed = True

    if not changed:
        return None
    return updated


def upgrade():
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, note_keys FROM annotations WHERE note_keys IS NOT NULL")
    ).fetchall()
    update_stmt = sa.text(
        "UPDATE annotations SET note_keys = :note_keys WHERE id = :id"
    ).bindparams(
        sa.bindparam("note_keys", type_=sa.JSON()),
        sa.bindparam("id", type_=sa.Text()),
    )

    for row in rows:
        updated_note_keys = _backfill_note_key_defaults(row.note_keys)
        if updated_note_keys is None:
            continue
        conn.execute(update_stmt, {"id": row.id, "note_keys": updated_note_keys})


def downgrade():
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, note_keys FROM annotations WHERE note_keys IS NOT NULL")
    ).fetchall()
    update_stmt = sa.text(
        "UPDATE annotations SET note_keys = :note_keys WHERE id = :id"
    ).bindparams(
        sa.bindparam("note_keys", type_=sa.JSON()),
        sa.bindparam("id", type_=sa.Text()),
    )

    for row in rows:
        updated_note_keys = _remove_note_key_defaults(row.note_keys)
        if updated_note_keys is None:
            continue
        conn.execute(update_stmt, {"id": row.id, "note_keys": updated_note_keys})
