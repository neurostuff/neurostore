"""Select analyses by what their extraction records say, over `analysis_features`.

A query names criteria; each is optional, and criteria combine with AND. A criterion is a
value, a list of values (any of them), or an object of `any`, `all` and `none` lists and
`when_silent`, which is `exclude` (the default: an analysis the record is silent about
does not match) or `include`. `or` takes a list of sub-queries, any of which may match.

Text criteria match whole words, case-insensitively; `*` matches any run of characters and
`?` one character, within one item, and a pattern needs three consecutive letters or
digits so that the trigram index can serve it.

A normalized criterion (medical_condition, task, contrast.set) takes `ids`, the terms a
normalizer mapped the record's wording to, and `text`, a pattern over that wording and the
terms' labels; given both, either may match. An id matches its descendants unless
`descendants` is false. `when_unmapped` decides the analyses whose record states the
feature but maps none of it: `exclude`, `include`, or `text` (the default where the field
has text), matching them by their wording alone. contrast.set has ids only. A bare value
is `text`, or `ids` where the field has no text.

`run_query` returns the canonical query, the counts, the first `limit` analyses and every
selected analysis's study id; with `funnel`, also what each criterion dropped and how many
analyses it found silent, which costs a count per criterion.
"""

import re
from dataclasses import dataclass

import sqlalchemy as sa

from neurostore.database import db
from neurostore.exceptions.factories import make_field_error
from neurostore.exceptions.utils.error_helpers import abort_validation
from neurostore.models import Analysis, AnalysisFeature, AnalysisFeatureDisplay

AF = AnalysisFeature
AFD = AnalysisFeatureDisplay
SILENT_MODES = ["exclude", "include"]
UNMAPPED_MODES = ["exclude", "include", "text"]
DEFAULT_LIMIT = 100
MAX_LIMIT = 1000
#: The fewest consecutive letters or digits a text pattern needs.
MIN_LITERAL = 3


@dataclass(frozen=True)
class Field:
    """One criterion: its kind, the column it reads, and its ids column."""

    kind: str  # text, normalized, value, array_value, groups, boolean, range
    column: object
    #: A normalized field's mapped ids, those and their ancestors, and its unmapped flag.
    ids: object = None
    ancestors: object = None
    unmapped: object = None
    #: Restricts a value criterion to these values.
    values: tuple = ()

    @property
    def silent(self):
        """The analyses whose record says nothing this criterion reads."""
        if self.unmapped is not None:
            return self.unmapped.is_(None)
        return self.column.is_(None)


def _normalized(name, text=True):
    """The normalized field whose columns are prefixed ``name``."""
    return Field(
        "normalized",
        getattr(AF, f"{name}_text") if text else None,
        ids=getattr(AF, f"{name}_ids"),
        ancestors=getattr(AF, f"{name}_ancestor_ids"),
        unmapped=getattr(AF, f"{name}_unmapped"),
    )


SPATIAL_SCOPES = ("whole_brain", "roi", "searchlight")
EFFECT_KINDS = (
    "simple_effect",
    "contrast",
    "interaction",
    "parametric_modulation",
    "cross_subject_regression",
    "omnibus",
)

#: Every criterion, by its dotted name: `contrast.*` and `design.*` nest in the query.
FIELDS = {
    "medical_condition": _normalized("medical_condition"),
    "has_patients": Field("boolean", AF.has_patients),
    "has_healthy": Field("boolean", AF.has_healthy),
    "species": Field("array_value", AF.species),
    "task": _normalized("task"),
    "spatial_scope": Field("value", AF.spatial_scope, values=SPATIAL_SCOPES),
    "coordinate_space": Field("text", AF.coordinate_space),
    "measure_type": Field("value", AF.measure_type),
    "measure_family": Field("value", AF.measure_family),
    "details_type": Field("value", AF.details_type),
    "is_meta_analysis": Field("boolean", AF.is_meta_analysis),
    "n": Field("range", AF.n),
    "has_coordinates": Field("boolean", Analysis.has_coordinates),
    "role": Field("value", Analysis.role),
    "contrast.positive": Field("text", AF.contrast_positive),
    "contrast.negative": Field("text", AF.contrast_negative),
    "contrast.set": _normalized("contrast_set", text=False),
    "contrast.kind": Field("value", AF.effect_kind, values=EFFECT_KINDS),
    "contrast.groups": Field("groups", AF.group_count, values=("between", "within")),
    "design.allocation": Field("value", AF.allocation),
    "design.assignment_structure": Field("value", AF.assignment_structure),
    "design.blinding": Field("value", AF.blinding),
    "design.arm_kind": Field("array_value", AF.arm_kinds),
    "design.longitudinal": Field("boolean", AF.longitudinal),
}
GROUPS = ("contrast", "design")
#: Criteria on `analyses` columns, which add a join.
JOINED = {"has_coordinates", "role"}


class QueryError(Exception):
    def __init__(self, errors):
        self.errors = errors


@dataclass
class Criterion:
    """A parsed criterion: its SQL condition, the analyses it is silent about (None for
    `or`), and the canonical form echoed back. A normalized criterion also has the
    analyses it found unmapped and how a result matched it; `or` has its sub-queries."""

    name: str
    condition: object
    silent: object
    canonical: object
    joins: bool = False
    unmapped: object = None
    matched_by: object = None
    subqueries: list = None


# ---------------------------------------------------------------------------
# text patterns
# ---------------------------------------------------------------------------


def pattern_regex(pattern):
    """A Postgres ARE matching ``pattern`` as whole words; None when it is too broad."""
    text = " ".join(str(pattern).split()).lower()
    if not re.search(rf"[^\W_]{{{MIN_LITERAL},}}", re.sub(r"[*?]", " ", text)):
        return None
    wildcards = {"*": "[^|]*", "?": "[^|]", " ": r"\s+"}
    body = "".join(wildcards.get(char) or re.escape(char) for char in text)
    start = r"\m" if re.match(r"\w", text) else ""
    end = r"\M" if re.search(r"\w$", text) else ""
    return f"{start}{body}{end}"


# ---------------------------------------------------------------------------
# parsing
# ---------------------------------------------------------------------------


def _silent_mode(path, raw, errors):
    mode = raw.get("when_silent", "exclude")
    if mode not in SILENT_MODES:
        errors.append(make_field_error(f"{path}.when_silent", mode, SILENT_MODES))
        return None
    return mode


def _unknown(path, raw, allowed, errors):
    unknown = sorted(set(raw) - set(allowed))
    for key in unknown:
        errors.append(make_field_error(f"{path}{key}", key, sorted(allowed), "UNKNOWN_FIELD"))
    return bool(unknown)


def _values_form(path, raw, errors):
    """``raw`` as ``{any, all, none, when_silent}``; None (with errors) when invalid."""
    if isinstance(raw, str):
        raw = {"any": [raw]}
    elif isinstance(raw, list):
        raw = {"any": raw}
    if not isinstance(raw, dict):
        errors.append(make_field_error(path, raw))
        return None
    if _unknown(f"{path}.", raw, ("any", "all", "none", "when_silent"), errors):
        return None
    form = {"when_silent": _silent_mode(path, raw, errors)}
    for part in ("any", "all", "none"):
        if part not in raw:
            continue
        values = raw[part]
        if not (
            isinstance(values, list)
            and values
            and all(isinstance(v, str) and v.strip() for v in values)
        ):
            errors.append(make_field_error(f"{path}.{part}", values))
            return None
        form[part] = values
    if len(form) == 1:
        errors.append(make_field_error(path, raw, code="MISSING_VALUE"))
        return None
    return form if form["when_silent"] else None


def _boolean_form(path, raw, errors):
    if isinstance(raw, bool):
        raw = {"is": raw}
    if not isinstance(raw, dict) or not isinstance(raw.get("is"), bool):
        errors.append(make_field_error(path, raw, ["is", "when_silent"]))
        return None
    if _unknown(f"{path}.", raw, ("is", "when_silent"), errors):
        return None
    mode = _silent_mode(path, raw, errors)
    return {"is": raw["is"], "when_silent": mode} if mode else None


def _range_form(path, raw, errors):
    bounds = {k: raw[k] for k in ("min", "max") if k in raw} if isinstance(raw, dict) else {}
    if not bounds or any(
        not isinstance(v, (int, float)) or isinstance(v, bool) for v in bounds.values()
    ):
        errors.append(make_field_error(path, raw, ["min", "max", "when_silent"]))
        return None
    if _unknown(f"{path}.", raw, ("min", "max", "when_silent"), errors):
        return None
    mode = _silent_mode(path, raw, errors)
    return {**bounds, "when_silent": mode} if mode else None


def _text_matcher(field, path, errors):
    def match(value):
        regex = pattern_regex(value)
        if regex is None:
            errors.append(make_field_error(path, value, code="PATTERN_TOO_BROAD"))
            return sa.false()
        return sa.and_(field.column.is_not(None), field.column.op("~")(regex))

    return match


def _groups_matcher(field, path, errors):
    return lambda value: field.column > 1 if value == "between" else field.column == 1


#: How one value of a criterion of each kind matches. Every match is false, never NULL,
#: on a silent record, so `none` is the complement of `any` among the records that speak.
MATCHERS = {
    "text": _text_matcher,
    "value": lambda field, path, errors: lambda value: field.column == value,
    "array_value": lambda field, path, errors: lambda value: field.column.contains(
        [value.lower()]
    ),
    "groups": _groups_matcher,
}


def _match(field, form, path, errors):
    """The condition ``form`` puts on ``field``, before silence is decided."""
    if field.kind == "range":
        bounds = []
        if "min" in form:
            bounds.append(field.column >= form["min"])
        if "max" in form:
            bounds.append(field.column <= form["max"])
        return sa.and_(*bounds)
    if field.kind == "boolean":
        return field.column.is_(form["is"])
    match = MATCHERS[field.kind](field, path, errors)
    parts = []
    if "any" in form:
        parts.append(sa.or_(*(match(v) for v in form["any"])))
    parts.extend(match(v) for v in form.get("all", []))
    if "none" in form:
        parts.append(sa.not_(sa.or_(*(match(v) for v in form["none"]))))
    return sa.and_(*parts)


def _strings(path, raw, errors):
    """``raw`` (a string or a list of them) as a list; None (with errors) when invalid."""
    values = [raw] if isinstance(raw, str) else raw
    valid = isinstance(values, list) and values
    if valid and all(isinstance(v, str) and v.strip() for v in values):
        return values
    errors.append(make_field_error(path, raw))
    return None


def _terms_form(path, raw, keys, errors):
    """``raw``'s ``keys`` (ids, text) as lists, or None (with errors)."""
    form = {}
    for key in keys:
        if key in raw:
            values = _strings(f"{path}{key}", raw[key], errors)
            if values is None:
                return None
            form[key] = values
    return form


def _normalized_form(path, raw, field, errors):
    """``raw`` as ``{ids, text, all, none, descendants, when_unmapped, when_silent}``."""
    keys = ("ids", "text") if field.column is not None else ("ids",)
    if isinstance(raw, (str, list)):
        raw = {keys[-1]: raw}
    if not isinstance(raw, dict):
        errors.append(make_field_error(path, raw))
        return None
    allowed = (*keys, "all", "none", "descendants", "when_unmapped", "when_silent")
    if _unknown(f"{path}.", raw, allowed, errors):
        return None
    form = _terms_form(f"{path}.", raw, keys, errors)
    if form is None:
        return None
    for part in ("all", "none"):
        if part not in raw:
            continue
        terms = raw[part]
        if not isinstance(terms, dict):
            errors.append(make_field_error(f"{path}.{part}", terms, list(keys)))
            return None
        if _unknown(f"{path}.{part}.", terms, keys, errors):
            return None
        terms = _terms_form(f"{path}.{part}.", terms, keys, errors)
        if terms is None:
            return None
        if not terms:
            errors.append(make_field_error(f"{path}.{part}", raw[part], code="MISSING_VALUE"))
            return None
        form[part] = terms
    if not form:
        errors.append(make_field_error(path, raw, code="MISSING_VALUE"))
        return None
    descendants = raw.get("descendants", True)
    if not isinstance(descendants, bool):
        errors.append(make_field_error(f"{path}.descendants", descendants))
        return None
    modes = UNMAPPED_MODES if field.column is not None else UNMAPPED_MODES[:2]
    unmapped = raw.get("when_unmapped", "text" if field.column is not None else "exclude")
    if unmapped not in modes:
        errors.append(make_field_error(f"{path}.when_unmapped", unmapped, modes))
        return None
    silent = _silent_mode(path, raw, errors)
    if silent is None:
        return None
    return {**form, "descendants": descendants, "when_unmapped": unmapped, "when_silent": silent}


def _normalized_match(field, form, path, errors):
    """``(matched, by_id, by_text)``: the condition ``form`` puts on ``field`` with its
    unmapped analyses decided, and whether an analysis matched a positive id or text part."""
    ids_column = field.ancestors if form["descendants"] else field.ids

    def terms(part, every, where):
        found = {}
        if "ids" in part:
            ids = part["ids"]
            held = (
                sa.and_(*(ids_column.contains([value]) for value in ids))
                if every
                else ids_column.overlap(ids)
            )
            found["ids"] = sa.and_(ids_column.is_not(None), held)
        if "text" in part:
            match = _text_matcher(field, f"{path}.{where}text", errors)
            patterns = [match(pattern) for pattern in part["text"]]
            found["text"] = sa.and_(*patterns) if every else sa.or_(*patterns)
        return found

    any_ = terms(form, False, "")
    all_ = terms(form.get("all", {}), True, "all.")
    none = terms(form.get("none", {}), False, "none.")
    parts = [sa.or_(*any_.values())] if any_ else []
    parts.extend(all_.values())
    if none:
        parts.append(sa.not_(sa.or_(*none.values())))
    matched = sa.and_(*parts)
    mode = form["when_unmapped"]
    worded = any("text" in found for found in (any_, all_, none))
    # Under `text` an unmapped analysis is judged by its wording alone, so a criterion with
    # no text cannot match it.
    if mode == "exclude" or (mode == "text" and not worded):
        matched = sa.and_(matched, field.unmapped.is_(False))
    elif mode == "include":
        matched = sa.or_(sa.and_(matched, field.unmapped.is_(False)), field.unmapped.is_(True))

    def either(key):
        found = [part[key] for part in (any_, all_) if key in part]
        return sa.or_(*found) if found else sa.false()

    return matched, either("ids"), either("text")


def _normalized_criterion(name, path, field, raw, errors):
    form = _normalized_form(path, raw, field, errors)
    if form is None:
        return None
    matched, by_id, by_text = _normalized_match(field, form, path, errors)
    matched = sa.and_(sa.not_(field.silent), matched)
    condition = sa.or_(matched, field.silent) if form["when_silent"] == "include" else matched
    unmapped = field.unmapped.is_(True)
    admitted = unmapped if form["when_unmapped"] == "include" else sa.false()
    # Only where the criterion holds: inside `or`, a result need not satisfy it. Under
    # `include` an unmapped analysis is in because it is unmapped, whatever its wording.
    matched_by = sa.case(
        (sa.not_(condition), None),
        (field.silent, "silent"),
        (by_id, "id"),
        (admitted, "unmapped"),
        (by_text, "text"),
        (unmapped, "unmapped"),
        else_=None,
    )
    return Criterion(name, condition, field.silent, form, unmapped=unmapped, matched_by=matched_by)


FORMS = {"range": _range_form, "boolean": _boolean_form}


def _criterion(name, path, field, raw, errors):
    if field.kind == "normalized":
        return _normalized_criterion(name, path, field, raw, errors)
    form = FORMS.get(field.kind, _values_form)(path, raw, errors)
    if form is None:
        return None
    if field.values:
        bad = [v for part in ("any", "all", "none") for v in form.get(part, [])]
        bad = [v for v in bad if v not in field.values]
        if bad:
            errors.append(make_field_error(path, bad, list(field.values)))
            return None
    matched = sa.and_(sa.not_(field.silent), _match(field, form, path, errors))
    condition = sa.or_(matched, field.silent) if form["when_silent"] == "include" else matched
    return Criterion(name, condition, field.silent, form, joins=name in JOINED)


def _parse_fields(raw, group, path, errors):
    """The criteria ``raw`` names among the fields of ``group`` ("" for the top level)."""
    prefix = f"{group}." if group else ""
    names = {}
    for name in FIELDS:
        rest = name.removeprefix(prefix)
        if name.startswith(prefix) and "." not in rest:
            names[rest] = name
    allowed = {*names, *(() if group else (*GROUPS, "or"))}
    _unknown(path, raw, allowed, errors)
    criteria = []
    for key, name in names.items():
        if key in raw:
            c = _criterion(name, f"{path}{key}", FIELDS[name], raw[key], errors)
            if c is not None:
                criteria.append(c)
    return criteria


def _parse_or(subqueries, path, errors):
    if not isinstance(subqueries, list) or len(subqueries) < 2:
        errors.append(make_field_error(path, subqueries))
        return None
    parsed = []
    for i, sub in enumerate(subqueries):
        try:
            sub_criteria = parse(sub, f"{path}[{i}].")
        except QueryError as error:
            errors.extend(error.errors)
            continue
        if not sub_criteria:
            errors.append(make_field_error(f"{path}[{i}]", sub, code="MISSING_VALUE"))
            continue
        parsed.append(sub_criteria)
    if len(parsed) != len(subqueries):
        return None
    return Criterion(
        "or",
        sa.or_(*(_where(sub) for sub in parsed)),
        None,
        [_canonical(sub) for sub in parsed],
        joins=any(c.joins for sub in parsed for c in sub),
        subqueries=parsed,
    )


def parse(query, path=""):
    """``query`` as a list of `Criterion`s, in the order of `FIELDS`; raises QueryError."""
    if not isinstance(query, dict):
        raise QueryError([make_field_error(path or "query", query)])
    errors = []
    criteria = _parse_fields(query, "", path, errors)
    for group in GROUPS:
        if group not in query:
            continue
        if not isinstance(query[group], dict) or not query[group]:
            errors.append(make_field_error(f"{path}{group}", query[group]))
            continue
        criteria += _parse_fields(query[group], group, f"{path}{group}.", errors)
    if "or" in query:
        alternatives = _parse_or(query["or"], f"{path}or", errors)
        if alternatives is not None:
            criteria.append(alternatives)
    if errors:
        raise QueryError(errors)
    return criteria


def _canonical(criteria):
    out = {}
    for c in criteria:
        group, _, name = c.name.rpartition(".")
        (out.setdefault(group, {}) if group else out)[name] = c.canonical
    return out


# ---------------------------------------------------------------------------
# running
# ---------------------------------------------------------------------------


def _from(criteria, study_ids=None):
    source = sa.select().select_from(AF)
    if any(c.joins for c in criteria):
        source = source.join(Analysis, Analysis.id == AF.analysis_id)
    if study_ids is not None:
        source = source.where(AF.study_id.in_(study_ids))
    return source


def _where(criteria):
    return sa.and_(sa.true(), *(c.condition for c in criteria))


def _parse_or_abort(query):
    try:
        return parse(query)
    except QueryError as error:
        abort_validation("The analysis query is not valid.", error.errors)


def selected_analysis_ids(query, study_ids):
    """The ids of the analyses of studies ``study_ids`` that ``query`` selects."""
    criteria = _parse_or_abort(query)
    statement = _from(criteria, study_ids).add_columns(AF.analysis_id).where(_where(criteria))
    return set(db.session.scalars(statement))


def _count(criteria, *conditions):
    """How many analyses match ``conditions``."""
    return db.session.scalar(_from(criteria).where(*conditions).add_columns(sa.func.count()))


def _count_papers(criteria, *conditions):
    """``{analyses, base_studies}`` matching ``conditions``; papers counted by hashing."""
    per_paper = (
        _from(criteria)
        .where(*conditions)
        .add_columns(AF.base_study_id, sa.func.count().label("n"))
        .group_by(AF.base_study_id)
        .subquery()
    )
    analyses, papers = db.session.execute(
        sa.select(sa.func.coalesce(sa.func.sum(per_paper.c.n), 0), sa.func.count()).select_from(
            per_paper
        )
    ).one()
    return {"analyses": int(analyses), "base_studies": papers}


def _funnel(criteria, selected):
    """Every analysis with features, and what each criterion in turn leaves.

    A statement a step, each served by the indexes; ``selected`` is the last step, which
    the caller has counted. One pass with a FILTER per step would run every pattern on
    every row. Steps that keep most of the table are the expensive ones.
    """
    searched = _count_papers([])
    steps, remaining = [], searched
    for i, c in enumerate(criteria):
        last = i == len(criteria) - 1
        kept = selected if last else _count_papers(criteria, _where(criteria[: i + 1]))
        steps.append(
            {
                "criterion": c.name,
                **kept,
                "dropped": remaining["analyses"] - kept["analyses"],
                "silent": (
                    _count(criteria, _where(criteria[:i]), c.silent)
                    if c.silent is not None
                    else None
                ),
                "unmapped": (
                    _count(criteria, _where(criteria[:i]), c.unmapped)
                    if c.unmapped is not None
                    else None
                ),
            }
        )
        remaining = kept
    return searched, steps


#: Columns each result lists beside its display values.
RESULT_COLUMNS = (
    "spatial_scope",
    "coordinate_space",
    "measure_type",
    "measure_family",
    "effect_kind",
    "group_count",
    "n",
    "has_patients",
    "has_healthy",
    "medical_condition_ids",
    "task_ids",
    "contrast_set_ids",
    "allocation",
    "assignment_structure",
    "blinding",
)


def _matched_by(criteria, prefix=""):
    """``{criterion path: how a result matched it}`` for the normalized criteria."""
    out = {}
    for c in criteria:
        if c.matched_by is not None:
            out[f"{prefix}{c.name}"] = c.matched_by
        for i, sub in enumerate(c.subqueries or []):
            out.update(_matched_by(sub, f"{prefix}or[{i}]."))
    return out


def _result(row, provenance):
    display = {k: v for k, v in (row["display"] or {}).items() if k != "contrast_sides"}
    matched_by = {name: row[f"matched_by_{i}"] for i, name in enumerate(provenance)}
    return {
        "analysis": row["analysis_id"],
        "study": row["study_id"],
        "base_study": row["base_study_id"],
        "name": display.get("name"),
        "matched_by": {name: how for name, how in matched_by.items() if how is not None},
        "features": {**display, **{name: row[name] for name in RESULT_COLUMNS}},
    }


def run_query(body):
    """Run an analysis query body: ``{"query": {...}, "limit": n, "funnel": bool}``."""
    limit = body.get("limit", DEFAULT_LIMIT)
    if not isinstance(limit, int) or isinstance(limit, bool) or not 0 <= limit <= MAX_LIMIT:
        abort_validation(
            f"limit is a whole number from 0 to {MAX_LIMIT}.",
            [make_field_error("limit", limit)],
        )
    criteria = _parse_or_abort(body.get("query", {}))
    selected = _from(criteria).where(_where(criteria))
    per_study = db.session.execute(
        selected.add_columns(AF.study_id, AF.base_study_id, sa.func.count()).group_by(
            AF.study_id, AF.base_study_id
        )
    ).all()
    counts = {
        "analyses": sum(n for _, _, n in per_study),
        "base_studies": len({base_study_id for _, base_study_id, _ in per_study}),
    }
    provenance = _matched_by(criteria)
    rows = db.session.execute(
        selected.outerjoin(AFD, AFD.analysis_id == AF.analysis_id)
        .add_columns(
            AF.analysis_id,
            AF.study_id,
            AF.base_study_id,
            AFD.display,
            *(getattr(AF, name) for name in RESULT_COLUMNS),
            *(how.label(f"matched_by_{i}") for i, how in enumerate(provenance.values())),
        )
        .order_by(AF.base_study_id, AF.analysis_id)
        .limit(limit)
    ).mappings().all()
    result = {
        "query": _canonical(criteria),
        "counts": {**counts, "studies": len(per_study)},
        "results": [_result(row, provenance) for row in rows],
        "study_ids": sorted(study_id for study_id, _, _ in per_study),
    }
    if body.get("funnel"):
        result["searched"], result["funnel"] = _funnel(criteria, counts)
    return result


#: Term listing field -> the criterion whose values it lists.
TERM_FIELDS = {
    "medical_condition": "medical_condition",
    "task": "task",
    "contrast_set": "contrast.set",
    "arm_kind": "design.arm_kind",
    "species": "species",
    "spatial_scope": "spatial_scope",
    "measure_type": "measure_type",
    "measure_family": "measure_family",
    "details_type": "details_type",
    "effect_kind": "contrast.kind",
    "allocation": "design.allocation",
    "assignment_structure": "design.assignment_structure",
    "blinding": "design.blinding",
}
#: Labels for a field's ids, unnested beside them.
TERM_LABELS = {
    "medical_condition": AF.medical_condition_labels,
    "contrast_set": AF.contrast_set_labels,
}


def list_terms(field, search=None, limit=50):
    """The values ``field`` takes, with how many analyses and papers carry each."""
    if field not in TERM_FIELDS:
        abort_validation(
            "Unknown term field.", [make_field_error("field", field, sorted(TERM_FIELDS))]
        )
    source_field = FIELDS[TERM_FIELDS[field]]
    column = source_field.ids if source_field.ids is not None else source_field.column
    labels = TERM_LABELS.get(field)
    if isinstance(column.type, sa.ARRAY):
        arrays = (column, labels) if labels is not None else (column,)
        names = ("value", "label") if labels is not None else ("value",)
        unnested = sa.func.unnest(*arrays).table_valued(*names).render_derived(name="t")
        source = sa.select().select_from(AF).join(unnested, sa.true())
        value = unnested.c.value
        label = sa.func.coalesce(unnested.c.label, value) if labels is not None else value
    else:
        source = sa.select().select_from(AF).where(column.is_not(None))
        value = label = column
    statement = source.add_columns(
        value.label("value"),
        sa.func.min(label).label("label"),
        sa.func.count().label("analyses"),
        sa.func.count(AF.base_study_id.distinct()).label("base_studies"),
    ).group_by(value)
    if search:
        like = f"%{search.lower()}%"
        statement = statement.where(
            sa.or_(sa.func.lower(value).like(like), sa.func.lower(label).like(like))
        )
    statement = statement.order_by(sa.desc("analyses"), value).limit(limit)
    return [row._asdict() for row in db.session.execute(statement)]
