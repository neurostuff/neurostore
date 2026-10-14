import hashlib

import sqlalchemy as sa
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship, validates

from neurostore.database import db
from neurostore.models.data import BaseMixin, BaseStudy

#: Tier of each ingestion source; lower is better: 1 JATS/XML, 2 ACE's HTML scrape, 3 PDF text.
FULLTEXT_SOURCE_TIERS = {
    "pubget": 1,
    "pmc": 1,
    "europepmc": 1,
    "elsevier": 1,
    "ace": 2,
    "pdf": 3,
}


class Fulltext(BaseMixin, db.Model):
    """One processed full text of a paper, as an ingestion workflow produced it."""

    __tablename__ = "fulltexts"

    base_study_id = db.Column(
        db.Text, db.ForeignKey("base_studies.id", ondelete="CASCADE"), nullable=False
    )
    source = db.Column(db.Text, nullable=False)
    source_version = db.Column(db.Text)
    _tier = db.Column("tier", db.SmallInteger, nullable=False)
    sha256 = db.Column(db.String(64), nullable=False)
    text = db.Column(db.Text, nullable=False)
    length = db.Column(db.Integer, nullable=False)

    __table_args__ = (
        sa.CheckConstraint(
            _tier.in_(sorted(set(FULLTEXT_SOURCE_TIERS.values()))), name="ck_fulltexts_tier"
        ),
        sa.UniqueConstraint("base_study_id", "sha256", name="uq_fulltexts_base_study_sha256"),
        sa.Index("ix_fulltexts_base_study_tier_created", "base_study_id", "tier", "created_at"),
    )

    base_study = relationship("BaseStudy", foreign_keys=[base_study_id])

    @hybrid_property
    def tier(self):
        return self._tier

    @validates("source")
    def _set_tier(self, key, source):
        try:
            self._tier = FULLTEXT_SOURCE_TIERS[source]
        except KeyError:
            raise ValueError(f"Unknown full text source: {source!r}") from None
        return source

    @validates("text")
    def _set_hash(self, key, text):
        self.sha256 = hashlib.sha256(text.encode("utf-8")).hexdigest()
        self.length = len(text)
        return text


def refresh_fulltext_pointer(connection, base_study_id):
    """Point the base study at its best full text: lowest tier, then newest."""
    best = (
        sa.select(Fulltext.id)
        .where(Fulltext.base_study_id == base_study_id)
        .order_by(Fulltext.tier, Fulltext.created_at.desc(), Fulltext.id)
        .limit(1)
        .scalar_subquery()
    )
    connection.execute(
        sa.update(BaseStudy.__table__)
        .where(BaseStudy.__table__.c.id == base_study_id)
        .values(fulltext_id=best)
    )
