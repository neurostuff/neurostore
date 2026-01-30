"""add cluster_measurement_unit to points

Revision ID: oysyl6yat5ns
Revises: d4c5a604ecc2
Create Date: 2026-01-21 19:25:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlalchemy_utils  # noqa: F401
import neurostore.models.migration_types  # noqa: F401


# revision identifiers, used by Alembic.
revision = 'oysyl6yat5ns'
down_revision = 'd4c5a604ecc2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('points', schema=None) as batch_op:
        batch_op.add_column(sa.Column('cluster_measurement_unit', sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table('points', schema=None) as batch_op:
        batch_op.drop_column('cluster_measurement_unit')
