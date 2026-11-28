"""Tables holding a project's curation and extraction state.

`neurosynth_compose.curation.codec` maps the frontend's provenance document to
these rows and back. In every table, ``extra`` holds an item's keys whose value
did not fit a typed column (or that the codec does not know), and ``missing``
lists known keys the item lacked; both are NULL for a well-formed item.
"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Identity,
    Index,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.sql import func

from neurosynth_compose.database import db
from neurosynth_compose.curation.codec import TAG_LISTS


def _project_fk():
    return Column(
        Text, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )


def _shape_columns():
    return (Column("extra", JSONB), Column("missing", ARRAY(Text)))


class CurationCitation(db.Model):
    """Citation fields shared by every stub that points at one Neurostore id.

    Rows are written once, from the first stub seen for the id, and never
    changed: a stub stores a field only when it differs from its citation.
    """

    __tablename__ = "curation_citations"

    neurostore_id = Column(Text, primary_key=True)
    title = Column(Text)
    authors = Column(Text)
    abstract = Column(Text)
    journal = Column(Text)
    year = Column(Text)
    doi = Column(Text)
    pmid = Column(Text)
    pmcid = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CurationColumn(db.Model):
    __tablename__ = "curation_columns"

    project_id = _project_fk()
    id = Column(Text, primary_key=True)
    position = Column(Integer, nullable=False)
    name = Column(Text)
    extra, missing = _shape_columns()


class CurationStub(db.Model):
    """One study on a project's curation board.

    Citation columns (title through pmcid) are NULL when the stub's value equals
    its `CurationCitation`. ``raw`` is ``[value]`` for a stub that is not a JSON
    object; such a stub has no other columns set.
    """

    __tablename__ = "curation_stubs"

    pk = Column(BigInteger, Identity(), primary_key=True)
    project_id = Column(
        Text, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    column_id = Column(Text, nullable=False)
    position = Column(Float, nullable=False)
    id = Column(Text)
    neurostore_id = Column(Text, ForeignKey("curation_citations.neurostore_id"))
    title = Column(Text)
    authors = Column(Text)
    abstract = Column(Text)
    journal = Column(Text)
    year = Column(Text)
    doi = Column(Text)
    pmid = Column(Text)
    pmcid = Column(Text)
    keywords = Column(Text)
    article_link = Column(Text)
    exclusion_tag_id = Column(Text)
    identification_source_id = Column(Text)
    import_id = Column(Text)
    search_term = Column(Text)
    extra, missing = _shape_columns()
    raw = Column(JSONB)
    content_hash = Column(Text, nullable=False)

    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "column_id"],
            ["curation_columns.project_id", "curation_columns.id"],
            ondelete="CASCADE",
        ),
        UniqueConstraint("project_id", "id", name="uq_curation_stubs_project_id"),
        Index("ix_curation_stubs_board", "project_id", "column_id", "position"),
        Index("ix_curation_stubs_neurostore_id", "neurostore_id"),
    )


class CurationStubTag(db.Model):
    """A tag on a stub: a project tag by id, or ``tag`` kept whole when the
    stub's copy differs from the project's tag of that id."""

    __tablename__ = "curation_stub_tags"

    stub_pk = Column(
        BigInteger,
        ForeignKey("curation_stubs.pk", ondelete="CASCADE"),
        primary_key=True,
    )
    position = Column(Integer, primary_key=True)
    tag_id = Column(Text, index=True)
    tag = Column(JSONB)


class CurationTag(db.Model):
    """A project's info tags, exclusion tags and PRISMA phase exclusion tags."""

    __tablename__ = "curation_tags"

    project_id = _project_fk()
    tag_list = Column(Text, primary_key=True)
    position = Column(Integer, primary_key=True)
    id = Column(Text)
    label = Column(Text)
    is_exclusion_tag = Column(Boolean)
    is_assignable = Column(Boolean)
    extra, missing = _shape_columns()

    __table_args__ = (CheckConstraint(tag_list.in_(TAG_LISTS), name="ck_curation_tags_tag_list"),)


class CurationSource(db.Model):
    __tablename__ = "curation_sources"

    project_id = _project_fk()
    position = Column(Integer, primary_key=True)
    id = Column(Text)
    label = Column(Text)
    extra, missing = _shape_columns()


class CurationImport(db.Model):
    __tablename__ = "curation_imports"

    project_id = _project_fk()
    position = Column(Integer, primary_key=True)
    id = Column(Text)
    name = Column(Text)
    date = Column(Text)
    import_mode = Column(Text)
    num_imported = Column(Integer)
    neurostore_search_params = Column(Text)
    file_name = Column(Text)
    extra, missing = _shape_columns()


class ExtractionStudyStatus(db.Model):
    __tablename__ = "extraction_study_statuses"

    project_id = _project_fk()
    position = Column(Integer, primary_key=True)
    study_id = Column(Text)
    status = Column(Text)
    extra, missing = _shape_columns()
