import hashlib

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, validates

from neurostore.database import db
from neurostore.models.data import BaseMixin, BaseStudy, license_type

#: The versions a full text's copy may be, most preferred first; None stands for a copy of no
#: stated version.
COPY_VERSIONS = ("vor", None, "am", "submitted")

#: The preference of each ingestion source a full text is known to come from; lower wins.
#: Any other source is taken, and ranks after all of these (UNKNOWN_SOURCE_RANK).
FULLTEXT_SOURCE_PREFERENCE = {
    "pubget": 0,
    "pmc": 0,
    "europepmc": 0,
    "elsevier": 0,
    "springer": 0,
    "ace": 1,
    "pdf": 2,
}
UNKNOWN_SOURCE_RANK = max(FULLTEXT_SOURCE_PREFERENCE.values()) + 1


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
    #: The licence of the copy the text was read from (study_schema's
    #: ``text_copy.license.license_id``); NULL when the copy states none.
    license = db.Column(license_type("fulltexts"))

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
        # What base_studies.fk_base_studies_fulltext_id refers to.
        sa.UniqueConstraint("id", "base_study_id", name="uq_fulltexts_id_base_study_id"),
        sa.Index("ix_fulltexts_base_study_created", "base_study_id", "created_at"),
        sa.CheckConstraint("source <> ''", name="ck_fulltexts_source_not_empty"),
        # Full-text search (ParadeDB's BM25 index), with ix_base_study_search's
        # tokenizer and the same layout.
        sa.Index(
            "ix_fulltext_search",
            *FULLTEXT_SEARCH_INDEX_FIELDS,
            postgresql_using="paradedb",
            postgresql_with={
                "target_segment_count": "1",
                "mutable_segment_rows": "0",
                "background_layer_sizes": "'16kB, 64kB, 256kB, 1MB, 4MB, 16MB, 64MB, 256MB, 1GB'",
            },
        ),
    )

    base_study = relationship("BaseStudy", foreign_keys=[base_study_id])

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
        sa.case(
            FULLTEXT_SOURCE_PREFERENCE, value=fulltext.source, else_=UNKNOWN_SOURCE_RANK
        ),
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


def find_or_add_fulltext(session, base_study_id, parsed_paper, text):
    """The base study's full text of ``text``; when it has none, one added with the
    source, copy and copy licence ``parsed_paper`` states."""
    fulltext = session.scalar(
        sa.select(Fulltext).where(
            Fulltext.base_study_id == base_study_id,
            Fulltext.sha256 == hashlib.sha256(text.encode("utf-8")).hexdigest(),
        )
    )
    if fulltext is None:
        fulltext = Fulltext(
            base_study_id=base_study_id,
            source=parsed_paper["source"],
            text=text,
            text_copy=parsed_paper["text_copy"],
            license=parsed_paper["text_copy"]["license"]["license_id"],
        )
        session.add(fulltext)
        session.flush()
    return fulltext
