import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from neurostore.database import db
from neurostore.models.data import BaseMixin
from neurostore.models.fulltext import Fulltext

REVIEW_SOURCE_ORIGINS = ("upload", "pipeline_run")
REVIEW_STATES = ("in_progress", "submitted", "reference")


class ReviewSource(BaseMixin, db.Model):
    """One extraction record of a paper loaded for review."""

    __tablename__ = "review_sources"

    #: The exact text the record's character offsets index.
    fulltext_id = db.Column(
        db.Text, db.ForeignKey("fulltexts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    parsed_paper = db.Column(JSONB)
    coordinate_parse = db.Column(JSONB)
    record = db.Column(JSONB, nullable=False)
    origin = db.Column(db.Text, nullable=False)
    pipeline_config_id = db.Column(
        db.Text, db.ForeignKey("pipeline_configs.id"), nullable=True, index=True
    )
    run_id = db.Column(db.Text, nullable=True)
    label = db.Column(db.Text)
    schema_versions = db.Column(JSONB)
    #: sha256 of the canonical JSON of record (sorted keys, no whitespace).
    record_sha256 = db.Column(db.String(64), nullable=False)
    loaded_by_id = db.Column(db.Text, db.ForeignKey("users.external_id"), index=True)

    __table_args__ = (
        sa.CheckConstraint(origin.in_(REVIEW_SOURCE_ORIGINS), name="ck_review_sources_origin"),
        sa.UniqueConstraint(
            "fulltext_id", "record_sha256", name="uq_review_sources_fulltext_record"
        ),
    )

    fulltext = relationship(Fulltext)


class Review(BaseMixin, db.Model):
    """One user's review of one source: the record as they have edited it so far."""

    __tablename__ = "reviews"

    source_id = db.Column(db.Text, db.ForeignKey("review_sources.id"), nullable=False)
    user_id = db.Column(
        db.Text, db.ForeignKey("users.external_id"), nullable=False, index=True
    )
    state = db.Column(
        db.Text, nullable=False, default="in_progress", server_default="in_progress"
    )
    record = db.Column(JSONB, nullable=False)
    coordinate_revision = db.Column(JSONB, nullable=True)
    provenance = db.Column(
        JSONB, nullable=False, default=dict, server_default=sa.text("'{}'::jsonb")
    )
    annotations = db.Column(
        JSONB, nullable=False, default=dict, server_default=sa.text("'{}'::jsonb")
    )
    last_seq = db.Column(db.Integer, nullable=False, default=0, server_default="0")

    __table_args__ = (
        sa.CheckConstraint(state.in_(REVIEW_STATES), name="ck_reviews_state"),
        sa.UniqueConstraint("source_id", "user_id", name="uq_reviews_source_user"),
        sa.Index(
            "uq_reviews_one_reference_per_source",
            "source_id",
            unique=True,
            postgresql_where=sa.text("state = 'reference'"),
        ),
    )

    source = relationship(ReviewSource)
    ops = relationship(
        "ReviewOp",
        back_populates="review",
        order_by="ReviewOp.seq",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ReviewOp(BaseMixin, db.Model):
    """One applied edit in a review's log, with the values it replaced and wrote."""

    __tablename__ = "review_ops"

    review_id = db.Column(
        db.Text, db.ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False
    )
    seq = db.Column(db.Integer, nullable=False)
    client_op_id = db.Column(db.Text, nullable=False)
    op = db.Column(JSONB, nullable=False)
    before = db.Column(JSONB)
    after = db.Column(JSONB)

    __table_args__ = (
        sa.UniqueConstraint("review_id", "seq", name="uq_review_ops_review_seq"),
        sa.UniqueConstraint("review_id", "client_op_id", name="uq_review_ops_review_client_op"),
    )

    review = relationship(Review, back_populates="ops")


class ReviewAssignment(BaseMixin, db.Model):
    """A paper an admin-reviewer has put in a user's queue."""

    __tablename__ = "review_assignments"

    base_study_id = db.Column(
        db.Text, db.ForeignKey("base_studies.id", ondelete="CASCADE"), nullable=False
    )
    user_id = db.Column(
        db.Text, db.ForeignKey("users.external_id"), nullable=False, index=True
    )
    assigned_by_id = db.Column(db.Text, db.ForeignKey("users.external_id"))

    __table_args__ = (
        sa.UniqueConstraint(
            "base_study_id", "user_id", name="uq_review_assignments_base_study_user"
        ),
    )

    base_study = relationship("BaseStudy")
