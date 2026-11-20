"""Which papers to ask: the pilot's criteria as one query over base studies.

A candidate is an active, unretracted paper published in or after ``since_year`` that
- has a coordinate parse with at least one result analysis holding coordinates;
- holds no images, has no NeuroVault study, and gives no NeuroVault link;
- gives a data repository link other than NeuroVault;
- has a corresponding author's address whose author gives an affiliation in ``country``
  (an address tied to no author, or an author with no ROR institution, does not count);
- has no outreach draft yet.

Newest first. Base studies keep only a publication year, so papers of one year are in the
order they were stored, newest first.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import aliased

from neurostore.models import (
    Analysis,
    BaseStudy,
    BaseStudyAuthorAffiliation,
    BaseStudyLink,
    CorrespondingAuthorEmail,
    LinkDomain,
    OutreachDraft,
    Study,
    University,
)
from neurostore.models.data import STUDY_SOURCE, result_analysis_clause
from neurostore.outreach.drafts import NEUROVAULT


def _result_analyses(column):
    """``column`` over the paper's result analyses with coordinates, in its coordinate parse."""
    return (
        sa.select(column)
        .select_from(Analysis)
        .join(Study, Study.id == Analysis.study_id)
        .where(
            Study.base_study_id == BaseStudy.id,
            Study.source == STUDY_SOURCE,
            Analysis.point_count > 0,
            result_analysis_clause(),
        )
    )


def _links(neurovault):
    link = aliased(BaseStudyLink)
    domain = aliased(LinkDomain)
    repository = domain.repository == NEUROVAULT if neurovault else domain.repository != NEUROVAULT
    return (
        sa.select(link.id)
        .join(domain, LinkDomain.matches(link, domain))
        .where(link.base_study_id == BaseStudy.id, domain.kind == "data_repository", repository)
        .exists()
    )


def _contact_in(country):
    return (
        sa.select(CorrespondingAuthorEmail.id)
        .join(
            BaseStudyAuthorAffiliation,
            BaseStudyAuthorAffiliation.base_study_author_id
            == CorrespondingAuthorEmail.base_study_author_id,
        )
        .join(University, University.id == BaseStudyAuthorAffiliation.university_id)
        .where(
            CorrespondingAuthorEmail.base_study_id == BaseStudy.id,
            University.country == country,
        )
        .exists()
    )


def candidates_query(since_year, country="US"):
    """The candidates: (base study, number of result analyses with coordinates)."""
    analysis_count = _result_analyses(sa.func.count(Analysis.id)).scalar_subquery()
    neurovault_study = (
        sa.select(Study.id)
        .where(Study.base_study_id == BaseStudy.id, Study.source == "neurovault")
        .exists()
    )
    drafted = (
        sa.select(OutreachDraft.id).where(OutreachDraft.base_study_id == BaseStudy.id).exists()
    )
    return (
        sa.select(BaseStudy, analysis_count.label("result_analyses"))
        .where(
            BaseStudy.is_active.is_(True),
            sa.func.coalesce(BaseStudy.is_retracted, False).is_(False),
            BaseStudy.year >= since_year,
            BaseStudy.has_images.is_(False),
            _result_analyses(Analysis.id).exists(),
            ~neurovault_study,
            ~_links(neurovault=True),
            _links(neurovault=False),
            _contact_in(country),
            ~drafted,
        )
        .order_by(BaseStudy.year.desc(), BaseStudy.created_at.desc(), BaseStudy.id)
    )
