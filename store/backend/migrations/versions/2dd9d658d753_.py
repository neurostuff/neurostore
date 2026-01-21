"""empty message

Revision ID: 2dd9d658d753
Revises: 8e3f3d8a9b5b, a1b2c3d4e5f6
Create Date: 2026-01-21 22:44:19.698887

"""
from alembic import op
import sqlalchemy as sa
import sqlalchemy_utils
import neurostore.models.migration_types


# revision identifiers, used by Alembic.
revision = '2dd9d658d753'
down_revision = ('8e3f3d8a9b5b', 'a1b2c3d4e5f6')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
