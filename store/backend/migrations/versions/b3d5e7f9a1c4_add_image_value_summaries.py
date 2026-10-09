"""add image_value_summaries

Revision ID: b3d5e7f9a1c4
Revises: a7b8c9d0e1f2
Create Date: 2026-08-22 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "b3d5e7f9a1c4"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "image_value_summaries",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.Column("image_id", sa.Text(), nullable=False),
        sa.Column("summarizer_version", sa.Integer(), nullable=False),
        sa.Column(
            "computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("source_url", sa.String()),
        sa.Column("source_sha256", sa.String(length=64)),
        sa.Column("source_bytes", sa.BigInteger()),
        sa.Column(
            "status",
            postgresql.ENUM(
                "SUCCESS",
                "FAILURE",
                "ERROR",
                "UNKNOWN",
                name="status_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("error", sa.String()),
        sa.Column("n_voxels", sa.BigInteger()),
        sa.Column("n_nan", sa.BigInteger()),
        sa.Column("n_zero", sa.BigInteger()),
        sa.Column("n_negative", sa.BigInteger()),
        sa.Column("n_values", sa.BigInteger()),
        sa.Column("value_min", sa.Float()),
        sa.Column("value_max", sa.Float()),
        sa.Column("value_mean", sa.Float()),
        sa.Column("value_std", sa.Float()),
        sa.Column("percentiles", postgresql.ARRAY(sa.Float())),
        sa.Column("histogram_min", sa.Float()),
        sa.Column("histogram_max", sa.Float()),
        sa.Column("histogram_counts", postgresql.ARRAY(sa.Integer())),
        sa.Column("histogram_underflow", sa.BigInteger()),
        sa.Column("histogram_overflow", sa.BigInteger()),
        sa.ForeignKeyConstraint(["image_id"], ["images.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_image_value_summaries_id", "image_value_summaries", ["id"], unique=False
    )
    op.create_index(
        "ix_image_value_summaries_created_at",
        "image_value_summaries",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_image_value_summaries_updated_at",
        "image_value_summaries",
        ["updated_at"],
        unique=False,
    )
    op.create_index(
        "ix_image_value_summaries_image_id",
        "image_value_summaries",
        ["image_id"],
        unique=True,
    )


def downgrade():
    op.drop_index(
        "ix_image_value_summaries_image_id", table_name="image_value_summaries"
    )
    op.drop_index(
        "ix_image_value_summaries_updated_at", table_name="image_value_summaries"
    )
    op.drop_index(
        "ix_image_value_summaries_created_at", table_name="image_value_summaries"
    )
    op.drop_index("ix_image_value_summaries_id", table_name="image_value_summaries")
    op.drop_table("image_value_summaries")
