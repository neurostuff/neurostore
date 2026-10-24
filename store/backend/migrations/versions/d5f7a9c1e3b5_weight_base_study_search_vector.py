"""weight the base study search vector and add full text to it

Revision ID: d5f7a9c1e3b5
Revises: a8e1c4d7b2f6
Create Date: 2026-10-23 12:00:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "d5f7a9c1e3b5"
down_revision = "a8e1c4d7b2f6"
branch_labels = None
depends_on = None

# Must match BaseStudy._ts_vector in neurostore/models/data.py.
WEIGHTED = """
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english',
        coalesce(
            CASE
                WHEN pubget_fulltext IS NOT NULL THEN pubget_fulltext
                ELSE ace_fulltext
            END,
            ''
        )
    ), 'C')
"""
UNWEIGHTED = (
    "to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))"
)


def _set_expression(expression):
    # Postgres recomputes the stored column and rebuilds its GIN index
    # in this one statement.
    op.execute(
        f"ALTER TABLE base_studies ALTER COLUMN __ts_vector__ "
        f"SET EXPRESSION AS ({expression})"
    )


def upgrade():
    _set_expression(WEIGHTED)


def downgrade():
    _set_expression(UNWEIGHTED)
