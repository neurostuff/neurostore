"""backfill included default note key

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


def _normalize_included_descriptor(note_keys):
    if not isinstance(note_keys, dict) or "included" not in note_keys:
        return None

    updated = deepcopy(note_keys)
    descriptor = updated.get("included")

    if isinstance(descriptor, dict):
        if descriptor.get("type") == "boolean" and descriptor.get("default") is None:
            descriptor["default"] = True
            updated["included"] = descriptor
            return updated
        return None

    if descriptor == "boolean":
        updated["included"] = {"type": "boolean", "default": True}
        return updated

    return None


def _remove_included_default(note_keys):
    if not isinstance(note_keys, dict) or "included" not in note_keys:
        return None

    updated = deepcopy(note_keys)
    descriptor = updated.get("included")

    if not isinstance(descriptor, dict) or "default" not in descriptor:
        return None

    descriptor.pop("default", None)
    if descriptor == {"type": "boolean"}:
        updated["included"] = "boolean"
    else:
        updated["included"] = descriptor
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
        updated_note_keys = _normalize_included_descriptor(row.note_keys)
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
        updated_note_keys = _remove_included_default(row.note_keys)
        if updated_note_keys is None:
            continue
        conn.execute(update_stmt, {"id": row.id, "note_keys": updated_note_keys})
