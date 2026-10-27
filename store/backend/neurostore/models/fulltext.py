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


#: The fields of ``ix_fulltext_search``, written as alembic reflects the migrated
#: index, so the two compare equal: the text, the copied title, abstract and
#: filter columns, and ``id_order``, the hash of the base study's id that breaks
#: ties as in ix_base_study_search.
FULLTEXT_SEARCH_INDEX_FIELDS = (
    "id",
    sa.text("(text::pdb.simple('stemmer=english'))"),
    sa.text("(name::pdb.simple('stemmer=english'))"),
    sa.text("(description::pdb.simple('stemmer=english'))"),
    "is_active",
    "public",
    sa.text("(user_id::pdb.literal)"),
    sa.text("(level::pdb.literal)"),
    "has_coordinates",
    "has_images",
    "is_oa",
    "year",
    sa.text("(hashtextextended(base_study_id, 0::bigint)::pdb.alias('alias=id_order'))"),
)


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

    # A copy of the base study's own searched and filtered columns, held only
    # by its preferred full text (the row base_studies.fulltext_id names) and
    # NULL on every other row, so that a full-text search runs inside one
    # index. Triggers keep it (see the migration that adds it); nothing else
    # writes it.
    name = db.Column(db.Text)
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean)
    public = db.Column(db.Boolean)
    user_id = db.Column(db.Text)
    level = db.Column(db.Text)
    has_coordinates = db.Column(db.Boolean)
    has_images = db.Column(db.Boolean)
    is_oa = db.Column(db.Boolean)
    year = db.Column(db.Integer)

    __table_args__ = (
        sa.UniqueConstraint("base_study_id", "sha256", name="uq_fulltexts_base_study_sha256"),
        sa.Index("ix_fulltexts_base_study_created", "base_study_id", "created_at"),
        sa.CheckConstraint(
            source.in_(FULLTEXT_SOURCE_PREFERENCE), name="ck_fulltexts_source"
        ),
        # Full-text search (ParadeDB's BM25 index), with ix_base_study_search's
        # tokenizer and the same layout.
        sa.Index(
            "ix_fulltext_search",
            *FULLTEXT_SEARCH_INDEX_FIELDS,
            postgresql_using="paradedb",
            postgresql_with={"target_segment_count": "1", "mutable_segment_rows": "0"},
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
