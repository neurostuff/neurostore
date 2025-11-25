"""normalize note_keys to ordered descriptors

Revision ID: f8c3bc088c2d
Revises: acdc4f0fbb22
Create Date: 2025-03-06 00:00:00.000000
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f8c3bc088c2d"
down_revision = "acdc4f0fbb22"
branch_labels = None
depends_on = None


ALLOWED_TYPES = {"string", "number", "boolean"}


def _ordered_keys(note_keys):
    keys = list(note_keys.keys())
    alphabetical = sorted(keys)
    return alphabetical if keys == alphabetical else keys


def _normalize_note_keys(note_keys):
    if not isinstance(note_keys, dict):
        return {}

    ordered_keys = _ordered_keys(note_keys)
    normalized = {}
    used_orders = set()
    next_order = 0

    for key in ordered_keys:
        descriptor = note_keys.get(key)
        note_type = None
        order = None

        if isinstance(descriptor, dict):
            note_type = descriptor.get("type")
            order = descriptor.get("order")
        else:
            note_type = descriptor

        if note_type not in ALLOWED_TYPES:
            note_type = "string"

        if isinstance(order, bool) or (order is not None and not isinstance(order, int)):
            order = None

        if isinstance(order, int) and order not in used_orders:
            used_orders.add(order)
            if order >= next_order:
                next_order = order + 1
        else:
            while next_order in used_orders:
                next_order += 1
            order = next_order
            used_orders.add(order)
            next_order += 1

        normalized[key] = {"type": note_type, "order": order}

    return normalized


def _downgrade_note_keys(note_keys):
    if not isinstance(note_keys, dict):
        return {}
    downgraded = {}
    for key, descriptor in note_keys.items():
        if isinstance(descriptor, dict):
            note_type = descriptor.get("type")
        else:
            note_type = descriptor
        downgraded[key] = note_type if note_type in ALLOWED_TYPES else "string"
    return downgraded


def upgrade():
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, note_keys FROM annotations")).fetchall()
    for row in rows:
        nk = row.note_keys
        if not nk:
            continue
        normalized = _normalize_note_keys(nk)
        conn.execute(
            sa.text("UPDATE annotations SET note_keys = :note_keys WHERE id = :id"),
            {"id": row.id, "note_keys": normalized},
        )


def downgrade():
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, note_keys FROM annotations")).fetchall()
    for row in rows:
        nk = row.note_keys
        if not nk:
            continue
        downgraded = _downgrade_note_keys(nk)
        conn.execute(
            sa.text("UPDATE annotations SET note_keys = :note_keys WHERE id = :id"),
            {"id": row.id, "note_keys": downgraded},
        )
