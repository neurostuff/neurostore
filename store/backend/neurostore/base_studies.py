"""Finding the base study a paper's identifiers name. Read-only: nothing is created."""

import sqlalchemy as sa

from neurostore.models import BaseStudy


def find_base_study(session, identifiers, *, active_only=True):
    """The oldest base study matching ``identifiers``, tried by neurostore_base_study_id,
    then doi, pmid and pmcid; None when none matches."""
    criteria = []
    base_study_id = identifiers.get("neurostore_base_study_id")
    if base_study_id:
        criteria.append(BaseStudy.id == base_study_id)
    for field in ("doi", "pmid", "pmcid"):
        if identifiers.get(field):
            criteria.append(getattr(BaseStudy, field) == identifiers[field])
    for criterion in criteria:
        query = sa.select(BaseStudy).where(criterion)
        if active_only:
            query = query.where(BaseStudy.is_active.is_(True))
        found = session.scalar(query.order_by(BaseStudy.created_at).limit(1))
        if found is not None:
            return found
    return None
