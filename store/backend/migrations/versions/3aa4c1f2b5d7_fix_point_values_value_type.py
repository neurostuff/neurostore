"""Fix point_values.value type drift.

Revision ID: 3aa4c1f2b5d7
Revises: 9a7c4d2e1f0b
Create Date: 2026-03-16 12:35:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3aa4c1f2b5d7"
down_revision = "9a7c4d2e1f0b"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("point_values"):
        return

    value_column = next(
        (
            column
            for column in inspector.get_columns("point_values")
            if column["name"] == "value"
        ),
        None,
    )
    if value_column is None or isinstance(value_column["type"], sa.Float):
        return

    with op.batch_alter_table("point_values", schema=None) as batch_op:
        batch_op.alter_column(
            "value",
            existing_type=sa.VARCHAR(),
            type_=sa.Float(),
            postgresql_using="value::double precision",
            existing_nullable=True,
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("point_values"):
        return

    value_column = next(
        (
            column
            for column in inspector.get_columns("point_values")
            if column["name"] == "value"
        ),
        None,
    )
    if value_column is None or isinstance(value_column["type"], sa.VARCHAR):
        return

    with op.batch_alter_table("point_values", schema=None) as batch_op:
        batch_op.alter_column(
            "value",
            existing_type=sa.Float(),
            type_=sa.VARCHAR(),
            postgresql_using="value::varchar",
            existing_nullable=True,
        )
