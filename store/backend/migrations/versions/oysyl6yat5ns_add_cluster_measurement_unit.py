"""add cluster_measurement_unit to points

Revision ID: oysyl6yat5ns
Revises: 8e3f3d8a9b5b
Create Date: 2026-01-21 19:25:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlalchemy_utils  # noqa: F401
import neurostore.models.migration_types  # noqa: F401


# revision identifiers, used by Alembic.
revision = 'oysyl6yat5ns'
down_revision = '8e3f3d8a9b5b'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('points', schema=None) as batch_op:
        batch_op.add_column(sa.Column('cluster_measurement_unit', sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table('points', schema=None) as batch_op:
        batch_op.drop_column('cluster_measurement_unit')
