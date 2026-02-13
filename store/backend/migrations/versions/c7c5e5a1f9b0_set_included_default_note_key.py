"""set default true for included note key

Revision ID: c7c5e5a1f9b0
Revises: d2f4a6b8c0e2
Create Date: 2026-01-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlalchemy_utils  # noqa: F401
import neurostore.models.migration_types  # noqa: F401


# revision identifiers, used by Alembic.
revision = 'c7c5e5a1f9b0'
down_revision = 'd2f4a6b8c0e2'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE annotations
            SET note_keys = jsonb_set(note_keys, '{included,default}', 'true'::jsonb, true)
            WHERE note_keys IS NOT NULL
              AND note_keys ? 'included'
            """
        )
    )


def downgrade():
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE annotations
            SET note_keys = jsonb_set(
                note_keys,
                '{included}',
                (note_keys->'included') - 'default',
                true
            )
            WHERE note_keys IS NOT NULL
              AND note_keys ? 'included'
              AND jsonb_typeof(note_keys->'included') = 'object'
            """
        )
    )
