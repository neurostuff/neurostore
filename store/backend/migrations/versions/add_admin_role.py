"""add admin role

Revision ID: add_admin_role
Revises: 8e3f3d8a9b5b
Create Date: 2026-01-21 19:33:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column


# revision identifiers, used by Alembic.
revision = "add_admin_role"
down_revision = "8e3f3d8a9b5b"
branch_labels = None
depends_on = None


def upgrade():
    # Define a minimal representation of the roles table for data operations
    roles_table = table(
        "roles",
        column("id", sa.Text),
        column("name", sa.Text),
        column("description", sa.Text),
        column("created_at", sa.DateTime),
        column("updated_at", sa.DateTime),
    )
    
    # Check if admin role already exists
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT COUNT(*) FROM roles WHERE name = 'admin'"))
    count = result.scalar()
    
    if count == 0:
        # Insert admin role
        op.execute(
            roles_table.insert().values(
                id="admin",
                name="admin",
                description="Administrator role with full access to all resources",
                created_at=sa.func.now(),
                updated_at=sa.func.now(),
            )
        )


def downgrade():
    # Remove admin role
    op.execute(sa.text("DELETE FROM roles_users WHERE role_id = 'admin'"))
    op.execute(sa.text("DELETE FROM roles WHERE name = 'admin'"))
