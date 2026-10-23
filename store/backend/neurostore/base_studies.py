"""Finding the base study a paper's identifiers name. Read-only: nothing is created."""

import sqlalchemy as sa

from neurostore.models import BaseStudy

VERSION_OF_RECORD_IDS = ("doi", "pmid", "pmcid")


def superseding_base_study(session, base_study_id):
    """The base study ``base_study_id`` names, followed through ``superseded_by`` to the
    one that supersedes it; None when the id is unknown."""
    base_study = session.get(BaseStudy, base_study_id)
    while base_study is not None and base_study.superseded_by is not None:
        base_study = session.get(BaseStudy, base_study.superseded_by)
    return base_study


def find_base_study(session, header):
    """The oldest active base study matching a parse artifact's ``header``, tried by its
    neurostore_base_study_id (followed to the base study superseding it), then the
    version of record's doi, pmid and pmcid, then each preprint DOI, each preprint pmid
    and each preprint pmcid; None when none matches."""
    for label, value in searched_identifiers(header):
        if label == "neurostore_base_study_id":
            found = superseding_base_study(session, value)
        else:
            found = session.scalar(
                sa.select(BaseStudy)
                .where(_COLUMN_OF[label] == value, BaseStudy.is_active.is_(True))
                .order_by(BaseStudy.created_at)
                .limit(1)
            )
        if found is not None and found.is_active:
            return found
    return None


def searched_identifiers(header):
    """The (label, value) of each identifier a match of ``header`` searches, in the order
    it tries them."""
    identifiers = header.get("identifiers") or {}
    if header.get("neurostore_base_study_id"):
        yield "neurostore_base_study_id", header["neurostore_base_study_id"]
    for field in VERSION_OF_RECORD_IDS:
        if identifiers.get(field):
            yield field, identifiers[field]
    for preprint_doi in identifiers.get("preprint_dois") or ():
        yield "preprint_doi", preprint_doi["doi"]
    for preprint_pmid in identifiers.get("preprint_pmids") or ():
        yield "preprint_pmid", preprint_pmid
    for preprint_pmcid in identifiers.get("preprint_pmcids") or ():
        yield "preprint_pmcid", preprint_pmcid


_COLUMN_OF = {
    "doi": BaseStudy.doi,
    "pmid": BaseStudy.pmid,
    "pmcid": BaseStudy.pmcid,
    "preprint_doi": BaseStudy.doi,
    "preprint_pmid": BaseStudy.pmid,
    "preprint_pmcid": BaseStudy.pmcid,
}
