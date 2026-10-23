import hashlib

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, validates

from neurostore.database import db
from neurostore.models.data import BaseMixin, BaseStudy

#: The versions a full text's copy may be, most preferred first; None stands for a copy of no
#: stated version.
COPY_VERSIONS = ("vor", None, "am", "submitted")

#: The ingestion sources a full text may come from, each with its preference; lower wins.
FULLTEXT_SOURCE_PREFERENCE = {
    "pubget": 0,
    "pmc": 0,
    "europepmc": 0,
    "elsevier": 0,
    "springer": 0,
    "ace": 1,
    "pdf": 2,
}


class Fulltext(BaseMixin, db.Model):
    """One processed full text of a paper, as an ingestion workflow produced it."""

    __tablename__ = "fulltexts"

    base_study_id = db.Column(
        db.Text, db.ForeignKey("base_studies.id", ondelete="CASCADE"), nullable=False
    )
    source = db.Column(db.Text, nullable=False)
    source_version = db.Column(db.Text)
    sha256 = db.Column(db.String(64), nullable=False)
    text = db.Column(db.Text, nullable=False)
    text_copy = db.Column(JSONB)

    __table_args__ = (
        sa.UniqueConstraint("base_study_id", "sha256", name="uq_fulltexts_base_study_sha256"),
        sa.Index("ix_fulltexts_base_study_created", "base_study_id", "created_at"),
        sa.CheckConstraint(
            source.in_(FULLTEXT_SOURCE_PREFERENCE), name="ck_fulltexts_source"
        ),
    )

    base_study = relationship("BaseStudy", foreign_keys=[base_study_id])

    @validates("source")
    def _check_source(self, key, source):
        if source not in FULLTEXT_SOURCE_PREFERENCE:
            raise ValueError(f"Unknown full text source: {source!r}")
        return source

    @validates("text")
    def _set_hash(self, key, text):
        self.sha256 = hashlib.sha256(text.encode("utf-8")).hexdigest()
        return text


def fulltext_preference(fulltext=Fulltext):
    """The order that ranks a paper's full texts, best first: the most preferred copy
    version, then source, then the newest."""
    return (
        sa.case(
            {version: rank for rank, version in enumerate(COPY_VERSIONS) if version},
            value=fulltext.text_copy["version"].astext,
            else_=COPY_VERSIONS.index(None),
        ),
        sa.case(FULLTEXT_SOURCE_PREFERENCE, value=fulltext.source),
        fulltext.created_at.desc(),
        fulltext.id,
    )


def refresh_fulltext_pointer(connection, base_study_id):
    """Point the base study at its full text that ranks first by fulltext_preference."""
    best = (
        sa.select(Fulltext.id)
        .where(Fulltext.base_study_id == base_study_id)
        .order_by(*fulltext_preference())
        .limit(1)
        .scalar_subquery()
    )
    connection.execute(
        sa.update(BaseStudy.__table__)
        .where(BaseStudy.__table__.c.id == base_study_id)
        .values(fulltext_id=best)
    )
