"""empty message

Revision ID: f2337d9c250c
Revises: 8e3f3d8a9b5b, oysyl6yat5ns
Create Date: 2026-01-21 19:33:41.925443

"""
from alembic import op
import sqlalchemy as sa
import sqlalchemy_utils
import neurostore.models.migration_types


# revision identifiers, used by Alembic.
revision = 'f2337d9c250c'
down_revision = ('8e3f3d8a9b5b', 'oysyl6yat5ns')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
