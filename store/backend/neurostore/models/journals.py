"""The journals, preprint servers and conference series papers appear in
(docs/journals/DESIGN.md). neurostore owns them: no user does, and nothing writes one
through the API."""

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


def _summary(journal_id_column):
    return (
        sa.select(
            sa.func.jsonb_build_object(
                "id", Journal.id, "title", Journal.title, "abbreviation", Journal.abbreviation
            )
        )
        .where(Journal.id == journal_id_column)
        .correlate_except(Journal)
        .scalar_subquery()
    )


# The journal as a study or base study shows it: one correlated lookup per row, in the
# row's own query.
BaseStudy.journal = sa.orm.column_property(_summary(BaseStudy.journal_id))
Study.journal = sa.orm.column_property(
    _summary(
        sa.select(BaseStudy.journal_id)
        .where(BaseStudy.id == Study.base_study_id)
        .correlate_except(BaseStudy)
        .scalar_subquery()
    )
)
