"""seed admin role

Revision ID: b7c8d9e0f1a2
Revises: oysyl6yat5ns
Create Date: 2026-01-28 00:15:00.000000

"""

from alembic import op
import sqlalchemy as sa  # noqa: F401
import sqlalchemy_utils  # noqa: F401
import neurostore.models.migration_types  # noqa: F401


# revision identifiers, used by Alembic.
revision = "b7c8d9e0f1a2"
down_revision = "oysyl6yat5ns"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        INSERT INTO roles (id, name, description)
        VALUES ('admin', 'admin', 'Admin role')
        ON CONFLICT DO NOTHING
        """
    )


def downgrade():
    op.execute("DELETE FROM roles_users WHERE role_id = 'admin'")
    op.execute("DELETE FROM roles WHERE id = 'admin'")
