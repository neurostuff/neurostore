"""Merge duplicate base studies of one paper from a plan of (keeper, old) pairs.

The plan is JSON: ``{"merges": [{"keeper": <id>, "old": <id>, ...}, ...]}``; keys
besides keeper and old (the evidence for the choice) are ignored. Compose runs the same
plan for the project provenance that names base studies.
"""

import json
from dataclasses import dataclass, field

import sqlalchemy as sa
from sqlalchemy.orm import aliased

from neurostore.base_studies import age_key
from neurostore.cache_versioning import bump_cache_versions
from neurostore.database import db
from neurostore.models import BaseStudy, BaseStudyMergeCandidate
from neurostore.resources.common import merge_unique_ids
from neurostore.services.base_study_metadata_enrichment import (
    BaseStudyMergeClash,
    Change,
    merge_base_study,
)
from neurostore.services.has_media_flags import recompute_media_flags


class BaseStudyMergeError(ValueError):
    """The plan, or one pair of it, names something the merge cannot act on."""


MERGED, ALREADY_MERGED, REFUSED = "merged", "already merged", "refused"


@dataclass
class PairOutcome:
    keeper_id: str
    old_id: str
    status: str
    refusal: str | None = None
    changes: list[Change] = field(default_factory=list)


def plan_from_candidates():
    """A plan of the open merge candidates, for a person to review, and the number of
    candidates left out of it. The keeper of a pair is its older base study; a candidate
    naming a base study already in the plan, or one no longer active, is left out (a later
    run plans it once the others are merged, which closes the candidates it settles)."""
    first, second = aliased(BaseStudy), aliased(BaseStudy)
    rows = db.session.execute(
        sa.select(BaseStudyMergeCandidate, first, second)
        .join(first, first.id == BaseStudyMergeCandidate.first_base_study_id)
        .join(second, second.id == BaseStudyMergeCandidate.second_base_study_id)
        .where(first.is_active.is_(True), second.is_active.is_(True))
    ).all()
    pairs = []
    for candidate, one, other in rows:
        keeper, old = sorted((one, other), key=lambda b: age_key(b.created_at, b.id))
        pairs.append((age_key(keeper.created_at, keeper.id), keeper, old, candidate))
    pairs.sort(key=lambda pair: (pair[0], age_key(pair[2].created_at, pair[2].id)))
    used, merges = set(), []
    for _, keeper, old, candidate in pairs:
        if {keeper.id, old.id} & used:
            continue
        used.update((keeper.id, old.id))
        merges.append(
            {
                "keeper": keeper.id,
                "old": old.id,
                "matched": candidate.matched,
                "source": candidate.source,
            }
        )
    return {"merges": merges}, len(rows) - len(merges)


def load_plan(path):
    """The (keeper, old) pairs of the plan at ``path``; refuses a malformed plan, a pair
    of one id, and an id named in more than one pair."""
    with open(path) as handle:
        plan = json.load(handle)
    merges = plan.get("merges") if isinstance(plan, dict) else None
    if not isinstance(merges, list) or not merges:
        raise BaseStudyMergeError('the plan has no "merges" list')
    pairs, seen = [], set()
    for index, merge in enumerate(merges):
        merge = merge if isinstance(merge, dict) else {}
        keeper_id, old_id = merge.get("keeper"), merge.get("old")
        if not (isinstance(keeper_id, str) and keeper_id and isinstance(old_id, str) and old_id):
            raise BaseStudyMergeError(f"merges[{index}] needs a keeper and an old id")
        if keeper_id == old_id:
            raise BaseStudyMergeError(f"merges[{index}] names {keeper_id} as keeper and old")
        repeated = {keeper_id, old_id} & seen
        if repeated:
            raise BaseStudyMergeError(
                f"merges[{index}] repeats {', '.join(sorted(repeated))}; merge chains one "
                "pair per plan run"
            )
        seen.update((keeper_id, old_id))
        pairs.append((keeper_id, old_id))
    return pairs


def _locked(base_study_id, role):
    base_study = db.session.get(BaseStudy, base_study_id, with_for_update=True)
    if base_study is None:
        raise BaseStudyMergeError(f"{role} {base_study_id} not found")
    return base_study


def _inactive(base_study, role):
    return BaseStudyMergeError(
        f"{role} {base_study.id} is inactive (superseded by {base_study.superseded_by})"
    )


def merge_base_studies(pairs, *, dry_run=True):
    """Merge each (keeper, old) pair in its own transaction, rolled back on a dry run,
    yielding each pair's outcome once its transaction ends. A pair whose old base study
    is already superseded by its keeper is already merged and changes nothing."""
    for keeper_id, old_id in pairs:
        try:
            keeper = _locked(keeper_id, "keeper")
            old = _locked(old_id, "old")
            if not keeper.is_active:
                raise _inactive(keeper, "keeper")
            if not old.is_active:
                if old.superseded_by == keeper.id:
                    db.session.rollback()
                    yield PairOutcome(keeper_id, old_id, ALREADY_MERGED)
                    continue
                raise _inactive(old, "old")
            merge = merge_base_study(keeper, old)
            db.session.flush()
            flagged = recompute_media_flags([keeper.id, old.id])
        except (BaseStudyMergeError, BaseStudyMergeClash) as error:
            db.session.rollback()
            yield PairOutcome(keeper_id, old_id, REFUSED, refusal=str(error))
            continue
        if dry_run:
            db.session.rollback()
        else:
            db.session.commit()
            bump_cache_versions(merge_unique_ids(merge.cache_ids, flagged))
        yield PairOutcome(keeper_id, old_id, MERGED, changes=merge.changes)
