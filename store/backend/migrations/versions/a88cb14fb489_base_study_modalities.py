"""base_studies.modalities and modalities_source: a paper's acquisition modalities

Revision ID: a88cb14fb489
Revises: d5f7a9c1e3b6
Create Date: 2026-11-19

Loaded from ns-pond's modality export by `manage base-study-modalities load`; empty until
then. `modality` is study_schema's Modality as of this migration, frozen here; a value
study_schema adds later needs `ALTER TYPE modality ADD VALUE` in a migration of its own.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "a88cb14fb489"
down_revision = "d5f7a9c1e3b6"
branch_labels = None
depends_on = None

MODALITIES = (
    "fMRI", "sMRI", "dMRI", "MRS", "MRI", "EEG", "iEEG", "fNIRS", "PET", "MEG", "SPECT", "CT",
    "physiological", "other",
)
SOURCES = ("record", "methods", "full_text", "none")


def upgrade():
    modality = postgresql.ENUM(*MODALITIES, name="modality")
    modality.create(op.get_bind())
    op.add_column(
        "base_studies",
        sa.Column(
            "modalities",
            postgresql.ARRAY(postgresql.ENUM(name="modality", create_type=False)),
            nullable=False,
            server_default="{}",
        ),
    )
    op.add_column("base_studies", sa.Column("modalities_source", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_base_studies_modalities_source",
        "base_studies",
        sa.column("modalities_source").in_(SOURCES),
    )
    op.create_index(
        "ix_base_studies_modalities", "base_studies", ["modalities"], postgresql_using="gin"
    )


def downgrade():
    op.drop_index("ix_base_studies_modalities", table_name="base_studies")
    op.drop_constraint("ck_base_studies_modalities_source", "base_studies")
    op.drop_column("base_studies", "modalities_source")
    op.drop_column("base_studies", "modalities")
    postgresql.ENUM(name="modality").drop(op.get_bind())
