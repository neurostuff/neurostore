"""The reviewer's revision of a paper's coordinate parse.

A revision is the original parse with the reviewer's verdicts applied: one
verdict per original analysis (``accept`` until the reviewer judges it), its
omitted analyses left out and its relabelled ones given their new role.
"""

import copy

from neurostore.review import ReviewError
from neurostore.study_schema_tools import sha256_of

APPLIED = ("accept", "relabel", "omit")
PRODUCER = {"name": "neurostore-review", "version": "1"}
UNJUDGED = "not judged by the reviewer"


def original_analysis(parse, analysis_key):
    """The analysis of the original ``parse`` with ``analysis_key``."""
    for analysis in (parse or {}).get("analyses") or ():
        if analysis["key"] == analysis_key:
            return analysis
    raise ReviewError(f"the coordinate parse has no analysis {analysis_key!r}")


def revise(parse, revision, analysis_key, action, role=None, reason=None):
    """``(revision, verdict before, verdict after)`` after recording ``action`` on
    ``analysis_key``; ``revision`` is None before the first verdict."""
    if action not in APPLIED:
        raise ReviewError(f"coordinate action {action!r} is not yet supported")
    if action == "relabel" and role is None:
        raise ReviewError("relabel needs a role")
    original_analysis(parse, analysis_key)
    verdicts = {v["key"]: v for v in (revision or {}).get("verdicts") or ()}
    before = copy.deepcopy(verdicts.get(analysis_key))
    verdict = {"key": analysis_key, "verdict": action, "reason": reason or f"reviewer {action}"}
    if action == "relabel":
        verdict["role"] = role
    verdicts[analysis_key] = verdict
    return _revision(parse, verdicts), before, copy.deepcopy(verdict)


def _revision(parse, verdicts):
    analyses, ordered = [], []
    for analysis in parse["analyses"]:
        verdict = verdicts.get(analysis["key"]) or {
            "key": analysis["key"], "verdict": "accept", "reason": UNJUDGED
        }
        ordered.append(verdict)
        if verdict["verdict"] == "omit":
            continue
        analysis = copy.deepcopy(analysis)
        if verdict["verdict"] == "relabel":
            analysis["role"] = verdict["role"]
        analyses.append(analysis)
    revision = copy.deepcopy(parse)
    revision["header"]["producer"] = dict(PRODUCER)
    revision["header"]["inputs"] = [
        {"artifact_kind": "parsed_paper", "fingerprint": parse["text_sha256"]},
        {"artifact_kind": "coordinate_parse", "fingerprint": parse["parse_id"]},
    ]
    revision.update(revision_of=parse["parse_id"], analyses=analyses, verdicts=ordered)
    identity = {k: revision[k] for k in ("revision_of", "analyses", "verdicts")}
    revision["parse_id"] = sha256_of(identity)
    return revision
