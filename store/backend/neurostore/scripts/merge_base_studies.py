"""Merge duplicate base studies of one paper from a plan of (keeper, old) pairs.

The plan is JSON: ``{"merges": [{"keeper": <id>, "old": <id>, ...}, ...]}``; keys
besides keeper and old (the evidence for the choice) are ignored. Compose runs the same
plan for the project provenance that names base studies.
"""

import json
from dataclasses import dataclass, field

from neurostore.cache_versioning import bump_cache_versions
from neurostore.database import db
from neurostore.models import BaseStudy
from neurostore.services.base_study_metadata_enrichment import (
    BaseStudyMergeClash,
    Change,
    merge_base_study,
)
from neurostore.services.has_media_flags import recompute_media_flags


class BaseStudyMergeError(ValueError):
    """The plan, or one pair of it, names something the merge cannot act on."""


@dataclass
class PairOutcome:
    keeper_id: str
    old_id: str
    merged: bool
    refusal: str | None = None
    changes: list[Change] = field(default_factory=list)


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


def _active(base_study_id, role):
    base_study = db.session.get(BaseStudy, base_study_id, with_for_update=True)
    if base_study is None:
        raise BaseStudyMergeError(f"{role} {base_study_id} not found")
    if not base_study.is_active:
        raise BaseStudyMergeError(
            f"{role} {base_study_id} is inactive (superseded by {base_study.superseded_by})"
        )
    return base_study


def merge_base_studies(pairs, *, dry_run=True):
    """Merge each (keeper, old) pair in its own transaction, rolled back on a dry run,
    and return what each pair changed or why it was refused."""
    outcomes = []
    for keeper_id, old_id in pairs:
        try:
            keeper = _active(keeper_id, "keeper")
            old = _active(old_id, "old")
            merge = merge_base_study(keeper, old)
            db.session.flush()
            recompute_media_flags([keeper.id])
        except (BaseStudyMergeError, BaseStudyMergeClash) as error:
            db.session.rollback()
            outcomes.append(PairOutcome(keeper_id, old_id, merged=False, refusal=str(error)))
            continue
        if dry_run:
            db.session.rollback()
        else:
            db.session.commit()
            bump_cache_versions(merge.cache_ids)
        outcomes.append(PairOutcome(keeper_id, old_id, merged=True, changes=merge.changes))
    return outcomes
