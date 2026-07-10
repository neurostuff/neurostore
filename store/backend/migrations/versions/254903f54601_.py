"""empty message

Revision ID: 254903f54601
Revises: f04a2376977d
Create Date: 2025-06-16 22:57:43.146837

"""

from alembic import op
import sqlalchemy as sa
import sqlalchemy_utils
import neurostore.models.migration_types
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "254903f54601"
down_revision = "f04a2376977d"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        ALTER TABLE pipelines
        ALTER COLUMN derived_from
        TYPE JSONB
        USING derived_from::jsonb
    """
    )


def downgrade():
    op.alter_column(
        "pipelines",
        "derived_from",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.TEXT(),
        existing_nullable=True,
    )
