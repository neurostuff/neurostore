"""Point project provenance at the keeper of each merged base study pair.

The plan is the one neurostore's ``merge-base-studies`` ran:
``{"merges": [{"keeper": <id>, "old": <id>, ...}, ...]}``. A curation stub names its
paper's base study in ``neurostoreId``; extraction and meta-analysis provenance name
study versions, studysets and annotations, which a merge leaves unchanged.
"""

import copy
import json
from dataclasses import dataclass, field

from sqlalchemy import String, cast, select

from neurosynth_compose.database import db
from neurosynth_compose.models.analysis import MetaAnalysis, Project


class BaseStudyMergeError(ValueError):
    """The plan, or one pair of it, cannot be applied to the provenance as found."""


@dataclass(frozen=True)
class Change:
    table: str
    row_id: str
    field: str
    before: object
    after: object


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


def _paths_holding(value, target, path=""):
    """Every path in ``value`` whose string is ``target``."""
    if isinstance(value, dict):
        for key, item in value.items():
            yield from _paths_holding(item, target, f"{path}.{key}" if path else key)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _paths_holding(item, target, f"{path}[{index}]")
    elif value == target:
        yield path


def _mentioning(model, base_study_id):
    return db.session.scalars(
        select(model)
        .where(cast(model.provenance, String).contains(f'"{base_study_id}"'))
        .order_by(model.id)
        .with_for_update()
    ).all()


def _repoint_stubs(project, keeper_id, old_id):
    provenance = copy.deepcopy(project.provenance)
    changes = []
    columns = (provenance.get("curationMetadata") or {}).get("columns") or []
    for c, column in enumerate(columns):
        stubs = column.get("stubStudies") or []
        held = {stub.get("neurostoreId") for stub in stubs}
        if keeper_id in held and old_id in held:
            raise BaseStudyMergeError(
                f"project {project.id} curation column {c} has stubs for both "
                f"{keeper_id} and {old_id}"
            )
        for s, stub in enumerate(stubs):
            if stub.get("neurostoreId") == old_id:
                stub["neurostoreId"] = keeper_id
                changes.append(
                    Change(
                        "projects",
                        project.id,
                        f"provenance.curationMetadata.columns[{c}].stubStudies[{s}]"
                        ".neurostoreId",
                        old_id,
                        keeper_id,
                    )
                )
    unexpected = list(_paths_holding(provenance, old_id))
    if unexpected:
        raise BaseStudyMergeError(
            f"project {project.id} names {old_id} outside a curation stub's neurostoreId: "
            + ", ".join(f"provenance.{p}" for p in unexpected)
        )
    project.provenance = provenance
    return changes


def merge_base_studies(pairs, *, dry_run=True):
    """Repoint each pair's curation stubs in its own transaction, rolled back on a dry
    run. A pair is refused, changing nothing, when a project would hold stubs for both
    base studies in one column or names the old one anywhere else, or a meta-analysis's
    provenance names it at all."""
    outcomes = []
    for keeper_id, old_id in pairs:
        try:
            changes = []
            for project in _mentioning(Project, old_id):
                changes.extend(_repoint_stubs(project, keeper_id, old_id))
            for meta_analysis in _mentioning(MetaAnalysis, old_id):
                paths = list(_paths_holding(meta_analysis.provenance, old_id))
                raise BaseStudyMergeError(
                    f"meta-analysis {meta_analysis.id} provenance names {old_id}: "
                    + ", ".join(f"provenance.{p}" for p in paths)
                )
            db.session.flush()
        except BaseStudyMergeError as error:
            db.session.rollback()
            outcomes.append(PairOutcome(keeper_id, old_id, merged=False, refusal=str(error)))
            continue
        if dry_run:
            db.session.rollback()
        else:
            db.session.commit()
        outcomes.append(PairOutcome(keeper_id, old_id, merged=True, changes=changes))
    return outcomes
