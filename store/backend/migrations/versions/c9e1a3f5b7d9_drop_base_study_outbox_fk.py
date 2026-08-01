"""drop base study outbox FK constraints

Revision ID: c9e1a3f5b7d9
Revises: b1c2d3e4f5a6
Create Date: 2026-08-01 22:40:30.897610
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "c9e1a3f5b7d9"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("base_study_metadata_outbox", schema=None) as batch_op:
        batch_op.drop_constraint(
            "base_study_metadata_outbox_base_study_id_fkey", type_="foreignkey"
        )
    with op.batch_alter_table("base_study_flag_outbox", schema=None) as batch_op:
        batch_op.drop_constraint(
            "base_study_flag_outbox_base_study_id_fkey", type_="foreignkey"
        )


def downgrade():
    with op.batch_alter_table("base_study_flag_outbox", schema=None) as batch_op:
        batch_op.create_foreign_key(
            "base_study_flag_outbox_base_study_id_fkey",
            "base_studies",
            ["base_study_id"],
            ["id"],
            ondelete="CASCADE",
        )
    with op.batch_alter_table("base_study_metadata_outbox", schema=None) as batch_op:
        batch_op.create_foreign_key(
            "base_study_metadata_outbox_base_study_id_fkey",
            "base_studies",
            ["base_study_id"],
            ["id"],
            ondelete="CASCADE",
        )
