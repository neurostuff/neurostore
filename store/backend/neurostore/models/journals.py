"""The journals, preprint servers and conference series papers appear in
(docs/journals/DESIGN.md). neurostore owns them: no user does, and nothing writes one
through the API. Each base study keeps a copy of its journal's title and abbreviation,
which triggers keep current (migration c3e5a7b9d1f2)."""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

from neurostore.database import db
from neurostore.models.data import BaseMixin, BaseStudy, Study

#: OpenAlex's source types.
JOURNAL_KINDS = (
    "journal",
    "repository",
    "conference",
    "book series",
    "ebook platform",
    "other",
)
#: How a base study's journal was identified: study_schema's ``VenueMatch``.
JOURNAL_MATCHES = ("doi", "pmid", "preprint_server", "issn", "title", "fuzzy")


class Journal(BaseMixin, db.Model):
    """One OpenAlex source. A renamed journal is two: a paper names the title it
    appeared under."""

    __tablename__ = "journals"
    openalex_id = db.Column(db.Text, nullable=False, unique=True)
    kind = db.Column(db.Text, nullable=False)
    title = db.Column(db.Text, nullable=False)
    #: NLM's ISO abbreviation, else its MEDLINE one.
    abbreviation = db.Column(db.Text, nullable=True)
    #: Every ISSN of the title; ``issn_l`` says which one links its versions.
    issns = db.Column(ARRAY(db.Text), nullable=False, server_default="{}")
    issn_l = db.Column(db.Text, nullable=True, unique=True)
    #: Not unique: NLM files some section journals under their parent's record.
    nlm_id = db.Column(db.Text, nullable=True)
    wikidata_id = db.Column(db.Text, nullable=True)

    __table_args__ = (
        sa.CheckConstraint(sa.column("kind").in_(JOURNAL_KINDS), name="ck_journals_kind"),
        sa.CheckConstraint("issn_l IS NULL OR issn_l = ANY(issns)", name="ck_journals_issn_l"),
        sa.Index("ix_journals_issns", "issns", postgresql_using="gin"),
    )


def _summary(base_studies):
    """The journal as a paper shows it, from a base study's copy of its title."""
    return sa.case(
        (base_studies.c.journal_id.is_(None), sa.null()),
        else_=sa.func.jsonb_build_object(
            "id",
            base_studies.c.journal_id,
            "title",
            base_studies.c.journal_title,
            "abbreviation",
            base_studies.c.journal_abbreviation,
        ),
    )


# A base study's journal is read from its own row; a study's, from its base study's row.
BaseStudy.journal = sa.orm.column_property(_summary(BaseStudy.__table__))
Study.journal = sa.orm.column_property(
    sa.select(_summary(BaseStudy.__table__))
    .where(BaseStudy.id == Study.base_study_id)
    .correlate_except(BaseStudy)
    .scalar_subquery()
)
