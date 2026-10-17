"""Finding the base study a paper's identifiers name. Read-only: nothing is created."""

import sqlalchemy as sa

from neurostore.models import BaseStudy

VERSION_OF_RECORD_IDS = ("doi", "pmid", "pmcid")


def find_base_study(session, header, *, active_only=True):
    """The oldest base study matching a parse artifact's ``header``, tried by its
    neurostore_base_study_id, then the version of record's doi, pmid and pmcid, then each
    preprint DOI, the preprint pmid and the preprint pmcid; None when none matches."""
    for label, value in searched_identifiers(header):
        query = sa.select(BaseStudy).where(_COLUMN_OF[label] == value)
        if active_only:
            query = query.where(BaseStudy.is_active.is_(True))
        found = session.scalar(query.order_by(BaseStudy.created_at).limit(1))
        if found is not None:
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
    if identifiers.get("preprint_pmid"):
        yield "preprint_pmid", identifiers["preprint_pmid"]
    if identifiers.get("preprint_pmcid"):
        yield "preprint_pmcid", identifiers["preprint_pmcid"]


_COLUMN_OF = {
    "neurostore_base_study_id": BaseStudy.id,
    "doi": BaseStudy.doi,
    "pmid": BaseStudy.pmid,
    "pmcid": BaseStudy.pmcid,
    "preprint_doi": BaseStudy.doi,
    "preprint_pmid": BaseStudy.pmid,
    "preprint_pmcid": BaseStudy.pmcid,
}
