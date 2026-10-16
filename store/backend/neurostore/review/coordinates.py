"""The reviewer's revision of a paper's coordinate parse.

A revision holds the reviewer's current analyses, each naming in ``derived_from`` the
original analyses it was made from; an analysis without it is an original carried over (its
key is an original key) or one the reviewer added. Each write derives every original's
verdict from those analyses, in the original parse's order, then an ``add`` verdict for each
added analysis. A verdict's reason is the note of the last op that changed it.
"""

import copy
from collections import defaultdict
from functools import cache

from jsonschema import validators
from study_schema.jsonschema import load

from neurostore.review import ReviewError
from neurostore.review.lists import indexed, splice
from neurostore.review.targets import target_key
from neurostore.review.validation import where
from neurostore.study_schema_tools import expected_key, sha256_of

PRODUCER = {"name": "neurostore-review", "version": "1"}
UNJUDGED = "not judged by the reviewer"


def known(parse, revision, analysis_key):
    """Raise unless the original ``parse`` or the ``revision`` has ``analysis_key``."""
    for document in (revision, parse):
        if any(a["key"] == analysis_key for a in (document or {}).get("analyses") or ()):
            return
    raise ReviewError(f"the coordinate parse has no analysis {analysis_key!r}")


def current(parse, revision):
    """The coordinates as the reviewer has them: the revision once there is one, else the parse."""
    return parse if revision is None else revision


def coordinate_state(provenance, key):
    """The provenance state of the analysis ``key``; None when it has none."""
    entry = provenance.get(target_key({"kind": "coordinate_analysis", "analysis_key": key}))
    return (entry or {}).get("state")


def rejected(provenance, keys):
    """The ``keys`` of the analyses ``provenance`` records as removed."""
    return {key for key in keys if coordinate_state(provenance, key) == "removed"}


def judged(parse, revision, provenance, ops):
    """The revision as export writes it: ``revision`` with the verdict ``ops`` that judged its
    analyses, as their review ``provenance`` still records them.

    An analysis verified takes the reason of its last verdict op; one removed is left out, so an
    original rejected unchanged reads omit. The others keep the reasons coordinate ops gave.
    """
    if parse is None:
        return revision
    work = _Revision(parse, revision)
    verdicts = [
        op
        for op in ops
        if op["type"] == "verdict" and op["target"]["kind"] == "coordinate_analysis"
    ]
    last = {op["target"]["analysis_key"]: op for op in verdicts}
    for op in verdicts:
        key = op["target"]["analysis_key"]
        index = work.find(key)
        expected = "removed" if op["verdict"] == "reject" else "verified"
        if last[key] is not op or index is None or coordinate_state(provenance, key) != expected:
            continue
        analysis = work.analyses[index]
        if op["verdict"] == "reject":
            del work.analyses[index]
        work.judge([analysis], op)
    return work.document()


def annotate(parse, revision, op):
    """``revision`` with the note of the accept verdict ``op`` as the reason of the originals its
    analysis comes from."""
    work = _Revision(parse, revision)
    work.judge([work.analyses[work.target(op)]], op)
    return work.document()


def revise(parse, revision, op):
    """``(revision, before, after, marks, replacements)`` after the coordinate ``op``.

    ``revision`` is None while the coordinates are as loaded; ``before`` and ``after`` hold what
    the op removed and inserted ({analyses: [{index, analysis}], reasons: {key: reason}});
    ``marks`` are the (analysis key, provenance state) pairs it touched; ``replacements`` are the
    (old keys, new analyses) it made, the target's key first.
    """
    if parse is None:
        raise ReviewError("the paper has no coordinate parse")
    work = _Revision(parse, revision)
    analyses, reasons = list(work.analyses), work.effective_reasons()
    marks = getattr(work, op["action"])(op)
    work.check_keys()
    document = work.document()
    after_reasons = work.effective_reasons()
    changed = sorted(k for k in reasons.keys() | after_reasons.keys()
                     if reasons.get(k) != after_reasons.get(k))
    before = {
        "analyses": indexed(analyses, work.analyses),
        "reasons": {k: reasons.get(k) for k in changed},
    }
    after = {
        "analyses": indexed(work.analyses, analyses),
        "reasons": {k: after_reasons.get(k) for k in changed},
    }
    return document, before, after, marks, work.replacements


def restore_op(before, after):
    """The coordinate op fields that undo an op which stored ``before`` and ``after``."""
    return {
        "type": "coordinate",
        "target": {"kind": "coordinate_parse"},
        "action": "restore",
        "payload": {
            "remove": after["analyses"],
            "insert": before["analyses"],
            "reasons": before["reasons"],
        },
    }


@cache
def _analysis_validator():
    schema = load("coordinate-parse")
    analysis = {"$defs": schema["$defs"], "$ref": "#/$defs/ParsedAnalysis"}
    return validators.validator_for(schema)(analysis)


class _Revision:
    def __init__(self, parse, revision):
        self.parse = parse
        self.order = {a["key"]: i for i, a in enumerate(parse["analyses"])}
        self.analyses = list((revision or parse)["analyses"])
        self.reasons = {
            v["key"]: v["reason"]
            for v in (revision or {}).get("verdicts") or ()
            if v["reason"] != UNJUDGED
        }
        self.replacements = []

    # the actions

    def relabel(self, op):
        index = self.target(op)
        self.analyses[index] = {**self.analyses[index], "role": op["role"]}
        self.judge([self.analyses[index]], op)
        return [(self.analyses[index]["key"], "edited")]

    def edit_points(self, op):
        index = self.target(op)
        analysis, payload = self.analyses[index], op["payload"]
        edited = {**analysis, "points": payload["points"]}
        if "name" in payload and payload["name"] != analysis["name"]:
            edited["name"] = payload["name"]
            edited.pop("name_is_printed", None)
        if "coordinate_space" in payload:
            edited["coordinate_space"] = payload["coordinate_space"]
        edited = self.keyed(edited, self.sources(analysis))
        self.analyses[index] = edited
        self.judge([edited], op)
        return self.replaced([analysis], [edited])

    def split(self, op):
        index = self.target(op)
        analysis = self.analyses[index]
        points = analysis.get("points") or []
        indices = sorted(i for part in op["payload"]["parts"] for i in part["indices"])
        if indices != list(range(len(points))):
            raise ReviewError(
                f"the split's parts do not partition the {len(points)} points of "
                f"{analysis['key']!r}: each index from 0 to {len(points) - 1} must be in "
                "exactly one part"
            )
        parts = []
        for n, part in enumerate(op["payload"]["parts"], 1):
            made = {**analysis, "points": [points[i] for i in part["indices"]]}
            if "name" in part:
                made["name"] = part["name"]
                made.pop("name_is_printed", None)
            else:
                made.update(name=f"{analysis['name']} (part {n})", name_is_printed=False)
            parts.append(self.keyed(made, self.sources(analysis)))
        self.analyses[index:index + 1] = parts
        self.judge(parts, op)
        return self.replaced([analysis], parts)

    def merge(self, op):
        index = self.target(op)
        analysis = self.analyses[index]
        if analysis["key"] in op["payload"]["with"]:
            raise ReviewError("an analysis cannot be merged with itself")
        others = [self.analyses[self.current(key)] for key in op["payload"]["with"]]
        merged = {**analysis, "points": [
            p for a in (analysis, *others) for p in a.get("points") or ()
        ]}
        for field in ("cells", "text_spans"):
            if any(a.get(field) for a in (analysis, *others)):
                merged[field] = _union(a.get(field) or [] for a in (analysis, *others))
        sources = [s for a in (analysis, *others) for s in self.sources(a)]
        merged = self.keyed(merged, sorted(set(sources), key=self.order.get))
        self.analyses[index] = merged
        self.analyses = [a for a in self.analyses if a not in others]
        self.judge([merged], op)
        return self.replaced([analysis, *others], [merged])

    def add(self, op):
        analysis = op["payload"]["analysis"]
        added = self.keyed(copy.deepcopy(analysis), [])
        self.analyses.append(added)
        self.judge([added], op)
        self.replacements.append(([], [added]))
        return [(added["key"], self.created(added["key"]))]

    def restore(self, op):
        payload = op["payload"]
        self.analyses = splice(self.analyses, payload["remove"], [], "analysis", _key)
        entries = sorted(payload["insert"], key=lambda e: e["index"])
        for entry in entries:
            self.check_restored(entry["analysis"])
        self.analyses = splice(self.analyses, [], entries, "analysis", _key)
        for key, reason in payload["reasons"].items():
            if reason is None:
                self.reasons.pop(key, None)
            else:
                self.reasons[key] = reason
        gone = [entry["analysis"] for entry in payload["remove"]]
        back = [entry["analysis"] for entry in entries]
        back_keys = {a["key"] for a in back}
        gone_marks = [(a["key"], "removed") for a in gone if a["key"] not in back_keys]
        back_marks = [(a["key"], self.created(a["key"])) for a in back if a not in gone]
        return gone_marks + back_marks

    # targets

    def target(self, op):
        """The index of the op's target analysis."""
        return self.current(op["target"]["analysis_key"])

    def current(self, key):
        """The index of ``key`` in the revision, raising when it is not there."""
        index = self.find(key)
        if index is not None:
            return index
        replacements = [a["key"] for a in self.analyses if key in self.sources(a)]
        if replacements:
            raise ReviewError(f"the coordinate revision has no analysis {key!r}; it was "
                              f"replaced by {', '.join(map(repr, replacements))}")
        raise ReviewError(f"the coordinate revision has no analysis {key!r}")

    def find(self, key):
        return next((i for i, a in enumerate(self.analyses) if a["key"] == key), None)

    # derivation

    def sources(self, analysis):
        """The original keys ``analysis`` comes from; none for an added one."""
        if analysis.get("derived_from"):
            return analysis["derived_from"]
        return [analysis["key"]] if analysis["key"] in self.order else []

    def keyed(self, analysis, sources):
        """``analysis`` with the key its content gives and ``sources`` as derived_from."""
        analysis = {k: v for k, v in analysis.items() if k != "derived_from"}
        analysis["key"] = _content_key({**analysis, "key": ""})
        if sources and sources != [analysis["key"]]:
            analysis["derived_from"] = list(sources)
        return analysis

    def check_restored(self, analysis):
        expected = _content_key(analysis)
        if analysis["key"] != expected:
            raise ReviewError(f"{analysis['key']!r} is not the key its name, space and points "
                              f"give ({expected!r})")
        unknown = [k for k in analysis.get("derived_from") or () if k not in self.order]
        if unknown:
            raise ReviewError(f"derived_from names {unknown[0]!r}, which is not an analysis of "
                              "the original parse")

    def check_keys(self):
        seen = set()
        for analysis in self.analyses:
            if analysis["key"] in seen:
                raise ReviewError(
                    f"the coordinate revision would hold two analyses with key "
                    f"{analysis['key']!r}"
                )
            seen.add(analysis["key"])

    def judge(self, analyses, op):
        """Give each original ``analyses`` come from, or each added one, the op's reason."""
        for analysis in analyses:
            for key in self.sources(analysis) or [analysis["key"]]:
                self.reasons[key] = _reason(op)

    def created(self, key):
        return "edited" if key in self.order else "added"

    def replaced(self, old, new):
        """The marks of an op that replaced the analyses ``old`` with ``new``."""
        self.replacements.append(([a["key"] for a in old], new))
        unchanged = {a["key"] for a in old} & {a["key"] for a in new}
        return [(a["key"], "edited") for a in old] + [
            (a["key"], self.created(a["key"])) for a in new if a["key"] not in unchanged
        ]

    def verdicts(self):
        replacements = defaultdict(list)
        for analysis in self.analyses:
            for key in self.sources(analysis):
                replacements[key].append(analysis)
        verdicts = []
        for original in self.parse["analyses"]:
            key = original["key"]
            found = replacements[key]
            verdict = {"key": key, "verdict": "omit", "reason": self.reasons.get(key, UNJUDGED)}
            if len(found) == 1 and found[0]["key"] == key:
                verdict["verdict"] = "accept"
                if found[0]["role"] != original["role"]:
                    verdict.update(verdict="relabel", role=found[0]["role"])
            elif len(found) == 1 and len(self.sources(found[0])) > 1:
                verdict.update(verdict="merge", replaced_by=[found[0]["key"]])
            elif len(found) == 1:
                verdict.update(verdict="edit", replaced_by=[found[0]["key"]])
            elif found:
                verdict.update(verdict="split", replaced_by=[a["key"] for a in found])
            verdicts.append(verdict)
        for analysis in self.analyses:
            if not self.sources(analysis):
                key = analysis["key"]
                verdicts.append({"key": key, "verdict": "add",
                                 "reason": self.reasons.get(key, "reviewer add")})
        return verdicts

    def effective_reasons(self):
        return {v["key"]: v["reason"] for v in self.verdicts() if v["reason"] != UNJUDGED}

    def document(self):
        """The revision, or None when it holds the original analyses with no verdict judged."""
        verdicts = self.verdicts()
        if self.analyses == self.parse["analyses"] and all(
            v["reason"] == UNJUDGED for v in verdicts
        ):
            return None
        header = {
            **self.parse["header"],
            "producer": dict(PRODUCER),
            "inputs": [
                {"artifact_kind": "parsed_paper", "fingerprint": self.parse["text_sha256"]},
                {"artifact_kind": "coordinate_parse", "fingerprint": self.parse["parse_id"]},
            ],
        }
        revision = {
            **self.parse,
            "header": header,
            "revision_of": self.parse["parse_id"],
            "analyses": list(self.analyses),
            "verdicts": verdicts,
        }
        identity = {k: revision[k] for k in ("revision_of", "analyses", "verdicts")}
        revision["parse_id"] = sha256_of(identity)
        return revision


def _reason(op):
    """The note of ``op``, else what it did."""
    if op.get("note"):
        return op["note"]
    if op["type"] == "coordinate":
        return f"reviewer {op['action']}"
    if op["verdict"] == "accept":
        return "reviewer accept"
    return f"reviewer reject ({op['reason']})"


def _content_key(analysis):
    """The key ``analysis`` gives, once it validates as a ParsedAnalysis."""
    error = next(iter(_analysis_validator().iter_errors(analysis)), None)
    if error is not None:
        raise ReviewError(
            f"the analysis does not validate against coordinate-parse at /{where(error)}: "
            f"{error.message}"
        )
    return expected_key(analysis)


def _key(analysis):
    return analysis["key"]


def _union(lists):
    """The items of ``lists`` in order, each once."""
    out = []
    for items in lists:
        out.extend(item for item in items if item not in out)
    return out
