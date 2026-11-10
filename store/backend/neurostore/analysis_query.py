"""Select analyses by what their extraction records say, over `analysis_features`.

A query names criteria; each is optional, and criteria combine with AND. A criterion is a
value, a list of values (any of them), or an object of `any`, `all` and `none` lists and
`when_silent`, which is `exclude` (the default: an analysis the record is silent about
does not match) or `include`. `or` takes a list of sub-queries, any of which may match.

Text criteria match whole words, case-insensitively; `*` matches any run of characters and
`?` one character, within one item, and a pattern needs three consecutive letters or
digits so that the trigram index can serve it.

A normalized criterion (medical_condition, task, contrast.key, contrast.set) takes `ids`,
the terms a normalizer mapped the record's wording to, and `text`, a pattern over that
wording and the terms' labels; given both, either may match. An id matches its
descendants (a task family its tasks, a family its contrast keys and sets) unless
`descendants` is false. `when_unmapped` decides the analyses whose record states the
feature but maps none of it: `exclude` (the default), `include`, or `text`, matching them
by their wording alone. Contrast keys and sets have ids only, and are directional: a term
with `:reversed` is the opposite direction. medical_condition's `role` (primary, comorbid,
none) narrows its ids to the items with that role. A bare value is `text`, or `ids` where
the field has no text.

`contrast.positive` and `contrast.negative` take criteria on one side of the contrast: its
names (`name`, the text of the side's cell levels and conditions), its groups' health and
medical conditions, its timepoints' relation to the intervention, its arms' kinds, and its
contrast keys' facets. A text criterion in their place is shorthand for its `name`.

`run_query` returns the canonical query, how many studies and analyses it selects, and a
page of the selected studies (all of them when `paginate` is false), each with its selected
analyses and their features, or less as `detail` says; with `funnel`, also what each
criterion dropped and how many analyses it found silent, which costs a count per
criterion. `base_study_ids` and `study_ids` restrict all of it to those papers or studies,
so an empty query with them returns their analyses' features.
"""

import re
from dataclasses import dataclass
from itertools import groupby

import orjson
import sqlalchemy as sa

from neurostore.database import db
from neurostore.exceptions.factories import make_field_error
from neurostore.exceptions.utils.error_helpers import abort_validation
from neurostore.models import (
    Analysis,
    AnalysisFeature,
    AnalysisFeatureDisplay,
    AnalysisTerm,
    Concept,
)

AF = AnalysisFeature
AFD = AnalysisFeatureDisplay
AT = AnalysisTerm
SILENT_MODES = ["exclude", "include"]
#: when_unmapped, for a field with text and for an ids-only one.
UNMAPPED_MODES = ["exclude", "include", "text"]
IDS_ONLY_UNMAPPED_MODES = ["exclude", "include"]
#: How much each listed study carries: itself, its selected analyses, and their features.
DETAILS = ("studies", "analyses", "features")
#: Rows a listing reads from its cursor at a time, and the response bytes sent at a time.
BATCH_ROWS = 2000
CHUNK_BYTES = 256 * 1024
#: Studies a page lists unless `page_size` says otherwise, as on the list endpoints.
DEFAULT_PAGE_SIZE = 20
#: The body keys that restrict a query to papers or to pipeline studies.
SCOPE_KEYS = ("base_study_ids", "study_ids")
#: The fewest consecutive letters or digits a text pattern needs.
MIN_LITERAL = 3


@dataclass(frozen=True)
class Field:
    """One criterion: its kind, the column it reads, and its ids column."""

    kind: str  # text, normalized, value, array_value, groups, boolean, range
    column: object
    #: A normalized field's mapped ids, those and their ancestors, and its unmapped flag;
    #: the same ids as "role|id", where the field has roles.
    ids: object = None
    ancestors: object = None
    unmapped: object = None
    role_ids: object = None
    role_ancestors: object = None
    #: Restricts a value criterion to these values.
    values: tuple = ()

    @property
    def silent(self):
        """The analyses whose record says nothing this criterion reads."""
        if self.unmapped is not None:
            return self.unmapped.is_(None)
        return self.column.is_(None)


def _normalized(name, text=True, roles=False):
    """The normalized field whose columns are prefixed ``name``."""
    return Field(
        "normalized",
        getattr(AF, f"{name}_text") if text else None,
        ids=getattr(AF, f"{name}_ids"),
        ancestors=getattr(AF, f"{name}_ancestor_ids"),
        unmapped=getattr(AF, f"{name}_unmapped"),
        role_ids=getattr(AF, f"{name}_role_ids") if roles else None,
        role_ancestors=getattr(AF, f"{name}_role_ancestor_ids") if roles else None,
    )


SPATIAL_SCOPES = ("whole_brain", "roi", "searchlight")
#: The roles ns-pond gives a medical condition's items.
MEDICAL_ROLES = ("primary", "comorbid", "none")
EFFECT_KINDS = (
    "simple_effect",
    "contrast",
    "interaction",
    "parametric_modulation",
    "cross_subject_regression",
    "omnibus",
)


def _side_fields(side):
    """The criteria on one side of the contrast, `contrast.<side>.*`."""
    prefix = f"contrast_{side}"
    return {
        f"contrast.{side}.name": Field("text", getattr(AF, prefix)),
        f"contrast.{side}.has_patients": Field("boolean", getattr(AF, f"{prefix}_has_patients")),
        f"contrast.{side}.has_healthy": Field("boolean", getattr(AF, f"{prefix}_has_healthy")),
        f"contrast.{side}.medical_condition": _normalized(f"{prefix}_medical_condition"),
        f"contrast.{side}.timepoint": Field("array_value", getattr(AF, f"{prefix}_timepoints")),
        f"contrast.{side}.arm_kind": Field("array_value", getattr(AF, f"{prefix}_arm_kinds")),
        f"contrast.{side}.facet": Field("array_value", getattr(AF, f"{prefix}_facets")),
    }


#: Every criterion, by its dotted name: `contrast.*`, `contrast.<side>.*` and `design.*`
#: nest in the query.
FIELDS = {
    "name": Field("text", AF.name_text),
    "medical_condition": _normalized("medical_condition", roles=True),
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
    "contrast.key": _normalized("contrast_key", text=False),
    "contrast.set": _normalized("contrast_set", text=False),
    "contrast.kind": Field("value", AF.effect_kind, values=EFFECT_KINDS),
    "contrast.groups": Field("groups", AF.group_count, values=("between", "within")),
    **_side_fields("positive"),
    **_side_fields("negative"),
    "design.allocation": Field("value", AF.allocation),
    "design.assignment_structure": Field("value", AF.assignment_structure),
    "design.blinding": Field("value", AF.blinding),
    "design.arm_kind": Field("array_value", AF.arm_kinds),
    "design.longitudinal": Field("boolean", AF.longitudinal),
}
GROUPS = ("contrast", "contrast.positive", "contrast.negative", "design")
#: The criterion a group takes a text criterion (a value, a list or any/all/none) in place
#: of itself as.
SHORTHAND = {"contrast.positive": "name", "contrast.negative": "name"}
VALUES_KEYS = {"any", "all", "none", "when_silent"}
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
        values = _strings(f"{path}.{part}", raw[part], errors)
        if values is None:
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


def _silenced(field, matched, mode):
    """``matched`` among the analyses that speak, and with ``include`` the silent ones."""
    matched = sa.and_(sa.not_(field.silent), matched)
    return sa.or_(matched, field.silent) if mode == "include" else matched


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


def _terms_part(path, raw, part, keys, errors):
    """``raw[part]`` (all, none) as ``{ids, text}`` lists, or None (with errors)."""
    terms = raw[part]
    if not isinstance(terms, dict):
        errors.append(make_field_error(f"{path}.{part}", terms, list(keys)))
        return None
    if _unknown(f"{path}.{part}.", terms, keys, errors):
        return None
    terms = _terms_form(f"{path}.{part}.", terms, keys, errors)
    if terms == {}:
        errors.append(make_field_error(f"{path}.{part}", raw[part], code="MISSING_VALUE"))
        return None
    return terms


def _role_form(path, raw, form, errors):
    """``raw``'s roles, which narrow a criterion with ids and no text; None (with errors)
    when invalid."""
    roles = _strings(f"{path}.role", raw["role"], errors)
    if roles is None:
        return None
    if set(roles) - set(MEDICAL_ROLES):
        errors.append(make_field_error(f"{path}.role", roles, list(MEDICAL_ROLES)))
        return None
    parts = [form, form.get("all", {}), form.get("none", {})]
    if any("text" in part for part in parts) or not any("ids" in part for part in parts):
        errors.append(make_field_error(f"{path}.role", roles, code="ROLE_NEEDS_IDS_ONLY"))
        return None
    return roles


def _normalized_form(path, raw, field, errors):
    """``raw`` as ``{ids, text, all, none, descendants, when_unmapped, when_silent}`` and
    ``role`` where the field has roles; None (with errors) when invalid."""
    keys = ("ids", "text") if field.column is not None else ("ids",)
    if isinstance(raw, (str, list)):
        raw = {keys[-1]: raw}
    if not isinstance(raw, dict):
        errors.append(make_field_error(path, raw))
        return None
    allowed = (*keys, "all", "none", "descendants", "when_unmapped", "when_silent")
    if field.role_ids is not None:
        allowed = (*allowed, "role")
    if _unknown(f"{path}.", raw, allowed, errors):
        return None
    form = _terms_form(f"{path}.", raw, keys, errors)
    if form is None:
        return None
    for part in ("all", "none"):
        if part in raw:
            form[part] = _terms_part(path, raw, part, keys, errors)
            if form[part] is None:
                return None
    if not form:
        errors.append(make_field_error(path, raw, code="MISSING_VALUE"))
        return None
    descendants = raw.get("descendants", True)
    if not isinstance(descendants, bool):
        errors.append(make_field_error(f"{path}.descendants", descendants))
        return None
    modes = UNMAPPED_MODES if field.column is not None else IDS_ONLY_UNMAPPED_MODES
    unmapped = raw.get("when_unmapped", "exclude")
    if unmapped not in modes:
        errors.append(make_field_error(f"{path}.when_unmapped", unmapped, modes))
        return None
    silent = _silent_mode(path, raw, errors)
    if silent is None:
        return None
    form = {**form, "descendants": descendants, "when_unmapped": unmapped, "when_silent": silent}
    if "role" in raw:
        form["role"] = _role_form(path, raw, form, errors)
        if form["role"] is None:
            return None
    return form


def _normalized_match(field, form, path, errors):
    """``(matched, by_id, by_text)``: the condition ``form`` puts on ``field`` with its
    unmapped analyses decided, and whether an analysis matched a positive id or text part."""
    ids_column = field.ancestors if form["descendants"] else field.ids
    roles = form.get("role")
    if roles:
        ids_column = field.role_ancestors if form["descendants"] else field.role_ids

    def terms(part, every, where):
        found = {}
        if "ids" in part:
            # An id as the column holds it: under any of the roles, where a role is given.
            variants = [
                [AF.role_id(r, i) for r in roles] if roles else [i] for i in part["ids"]
            ]
            held = (
                sa.and_(*(ids_column.overlap(v) for v in variants))
                if every
                else ids_column.overlap([v for vs in variants for v in vs])
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
    condition = _silenced(field, matched, form["when_silent"])
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
    condition = _silenced(field, _match(field, form, path, errors), form["when_silent"])
    return Criterion(name, condition, field.silent, form, joins=name in JOINED)


def _members(group, names):
    """``{key: dotted name}`` of the ``names`` directly in ``group`` ("" for the top)."""
    prefix = f"{group}." if group else ""
    members = {}
    for name in names:
        rest = name.removeprefix(prefix)
        if name.startswith(prefix) and "." not in rest:
            members[rest] = name
    return members


def _parse_fields(raw, group, path, errors):
    """The criteria ``raw`` names among the fields of ``group`` ("" for the top level) and
    the groups nested in it."""
    names = _members(group, FIELDS)
    groups = _members(group, GROUPS)
    _unknown(path, raw, {*names, *groups, *(() if group else ("or",))}, errors)
    criteria = []
    for key, name in names.items():
        if key in raw:
            c = _criterion(name, f"{path}{key}", FIELDS[name], raw[key], errors)
            if c is not None:
                criteria.append(c)
    for key, name in groups.items():
        if key in raw:
            criteria += _parse_group(raw[key], name, f"{path}{key}", errors)
    return criteria


def _parse_group(raw, group, path, errors):
    shorthand = isinstance(raw, (str, list)) or (
        isinstance(raw, dict) and raw and set(raw) <= VALUES_KEYS
    )
    if group in SHORTHAND and shorthand:
        raw = {SHORTHAND[group]: raw}
    if not isinstance(raw, dict) or not raw:
        errors.append(make_field_error(path, raw))
        return []
    return _parse_fields(raw, group, f"{path}.", errors)


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
        *groups, name = c.name.split(".")
        node = out
        for group in groups:
            node = node.setdefault(group, {})
        node[name] = c.canonical
    return out


# ---------------------------------------------------------------------------
# running
# ---------------------------------------------------------------------------


def _from(criteria, study_ids=None, base_study_ids=None):
    source = sa.select().select_from(AF)
    if any(c.joins for c in criteria):
        source = source.join(Analysis, Analysis.id == AF.analysis_id)
    if study_ids is not None:
        source = source.where(AF.study_id.in_(study_ids))
    if base_study_ids is not None:
        source = source.where(AF.base_study_id.in_(base_study_ids))
    return source


def _where(criteria):
    return sa.and_(sa.true(), *(c.condition for c in criteria))


def _parse_or_abort(query):
    try:
        return parse(query)
    except QueryError as error:
        abort_validation("The analysis query is not valid.", error.errors)


def _scope_or_abort(body):
    """The papers and studies ``body`` restricts the query to, as `_from` keywords."""
    scope, errors = {}, []
    for key in SCOPE_KEYS:
        if key not in body:
            continue
        ids = body[key]
        if not isinstance(ids, list) or not all(isinstance(i, str) and i for i in ids):
            errors.append(make_field_error(key, ids))
            continue
        scope[key] = sorted(set(ids))
    if errors:
        abort_validation(f"{' and '.join(SCOPE_KEYS)} are lists of ids.", errors)
    return scope


def _whole_number_or_abort(body, key, default, minimum):
    value = body.get(key, default)
    if key in body and (not isinstance(value, int) or isinstance(value, bool) or value < minimum):
        abort_validation(
            f"{key} is a whole number of at least {minimum}.", [make_field_error(key, value)]
        )
    return value


def select_analyses(query, study_ids, analysis_ids):
    """What ``query`` selects among ``analysis_ids`` (of studies ``study_ids``), frozen:
    ``{query, analysis_ids, mapping_tools}``, the query canonical and the normalizers
    and fits the selected analyses' ids came from."""
    criteria = _parse_or_abort(query)
    statement = (
        _from(criteria, study_ids)
        .add_columns(AF.analysis_id, AF.mapping_tools)
        .where(_where(criteria), AF.analysis_id.in_(list(analysis_ids)))
    )
    selected = db.session.execute(statement).all()
    return {
        "query": _canonical(criteria),
        "analysis_ids": sorted(analysis_id for analysis_id, _ in selected),
        "mapping_tools": sorted({tool for _, tools in selected for tool in tools or []}),
    }


def _count(criteria, *conditions, scope=None):
    """How many analyses match ``conditions`` within ``scope``."""
    return db.session.scalar(
        _from(criteria, **(scope or {})).where(*conditions).add_columns(sa.func.count())
    )


def _count_papers(criteria, *conditions, scope=None):
    """``{analyses, base_studies}`` matching ``conditions`` within ``scope``; papers counted
    by hashing."""
    per_paper = (
        _from(criteria, **(scope or {}))
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


def _funnel(criteria, scope=None):
    """Every analysis with features (within ``scope``), and what each criterion in turn
    leaves.

    A statement a step, each served by the indexes. One pass with a FILTER per step would
    run every pattern on every row. Steps that keep most of the table are the expensive
    ones.
    """
    searched = _count_papers([], scope=scope)
    steps, remaining = [], searched
    for i, c in enumerate(criteria):
        kept = _count_papers(criteria, _where(criteria[: i + 1]), scope=scope)
        steps.append(
            {
                "criterion": c.name,
                **kept,
                "dropped": remaining["analyses"] - kept["analyses"],
                "silent": (
                    _count(criteria, _where(criteria[:i]), c.silent, scope=scope)
                    if c.silent is not None
                    else None
                ),
                "unmapped": (
                    _count(criteria, _where(criteria[:i]), c.unmapped, scope=scope)
                    if c.unmapped is not None
                    else None
                ),
            }
        )
        remaining = kept
    return searched, steps


#: Columns each result lists beside its display values.
RESULT_COLUMNS = (
    # Which extraction the row was read from, and when it was written.
    "config_id",
    "updated_at",
    "is_meta_analysis",
    "details_type",
    "species",
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
    "task_family_ids",
    "contrast_key_ids",
    "contrast_set_ids",
    "allocation",
    "assignment_structure",
    "blinding",
    "arm_kinds",
    "longitudinal",
    *(
        f"contrast_{side}_{column}"
        for side in ("positive", "negative")
        for column in (
            "has_patients",
            "has_healthy",
            "medical_condition_ids",
            "timepoints",
            "arm_kinds",
            "facets",
        )
    ),
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


def _raw(column):
    """``column`` as psycopg2 returns it, with no SQLAlchemy result processing."""
    if isinstance(column.type, sa.ARRAY):
        column = sa.cast(column, sa.ARRAY(sa.Text))
    return sa.type_coerce(column, sa.types.NullType())


def _analysis(row, provenance, features):
    """One listed analysis: its id, name and matches, and with ``features`` its features."""
    matched_by = {name: row[f"matched_by_{i}"] for i, name in enumerate(provenance)}
    display = orjson.loads(row["display"] or "{}") if features else {"name": row["name"]}
    result = {
        "id": row["analysis_id"],
        "name": display.get("name"),
        "matched_by": {name: how for name, how in matched_by.items() if how is not None},
    }
    if features:
        display = {k: v for k, v in display.items() if k != "contrast_sides"}
        result["features"] = {**display, **{name: row[name] for name in RESULT_COLUMNS}}
    return result


def _bool_or_abort(body, key, default):
    value = body.get(key, default)
    if not isinstance(value, bool):
        abort_validation(f"{key} is true or false.", [make_field_error(key, value)])
    return value


def run_query(body):
    """Run an analysis query body: ``{"query": {...}, "page": n, "page_size": n,
    "paginate": bool, "detail": "studies" | "analyses" | "features", "funnel": bool,
    "base_study_ids": [...], "study_ids": [...]}``.

    Returns the response's JSON text in chunks. The results are the studies with a
    selected analysis, a page of them unless `paginate` is false, each with as much as
    `detail` asks for; they come last, read and written a batch at a time, so a listing
    of the whole corpus never sits in memory. The body is checked and the counts taken
    first, so a refused query is answered before anything is sent.
    """
    page = _whole_number_or_abort(body, "page", 1, 1)
    page_size = _whole_number_or_abort(body, "page_size", DEFAULT_PAGE_SIZE, 0)
    paginate = _bool_or_abort(body, "paginate", True)
    detail = body.get("detail", "features")
    if detail not in DETAILS:
        abort_validation(
            f"detail is one of {', '.join(DETAILS)}.",
            [make_field_error("detail", detail, list(DETAILS))],
        )
    scope = _scope_or_abort(body)
    criteria = _parse_or_abort(body.get("query", {}))
    selected = _from(criteria, **scope).where(_where(criteria))
    studies, analyses = db.session.execute(
        selected.add_columns(sa.func.count(AF.study_id.distinct()), sa.func.count())
    ).one()
    head = {
        "metadata": {"total_count": studies, "analysis_count": analyses},
        "query": _canonical(criteria),
    }
    if body.get("funnel"):
        head["searched"], head["funnel"] = _funnel(criteria, scope)
    listing = None
    if not (paginate and page_size == 0):
        listing = _listing(selected, criteria, page, page_size, paginate, detail)
    return _chunks(head, listing, criteria, detail)


def _listing(selected, criteria, page, page_size, paginate, detail):
    """The statement listing the page's studies, by paper, with what ``detail`` asks for."""
    studies = (
        selected.add_columns(AF.base_study_id, AF.study_id)
        .group_by(AF.base_study_id, AF.study_id)
        .order_by(AF.base_study_id, AF.study_id)
    )
    if paginate:
        studies = studies.offset((page - 1) * page_size).limit(page_size)
    if detail == "studies":
        return studies
    listing = selected
    if paginate:
        on_page = studies.subquery()
        listing = listing.where(AF.study_id.in_(sa.select(on_page.c.study_id)))
    provenance = _matched_by(criteria)
    # The display as text for orjson, and arrays as text[] that psycopg2 parses itself: on
    # the whole corpus json.loads and SQLAlchemy's per-item array processing, with the
    # ORM's row handling, were 40% of the time.
    return (
        listing.outerjoin(AFD, AFD.analysis_id == AF.analysis_id)
        .add_columns(
            AF.analysis_id,
            AF.study_id,
            AF.base_study_id,
            *(
                (
                    sa.cast(AFD.display, sa.Text).label("display"),
                    *(_raw(getattr(AF, name)).label(name) for name in RESULT_COLUMNS),
                )
                if detail == "features"
                else (AFD.display["name"].astext.label("name"),)
            ),
            *(how.label(f"matched_by_{i}") for i, how in enumerate(provenance.values())),
        )
        .order_by(AF.base_study_id, AF.study_id, AF.analysis_id)
    )


def _chunks(head, listing, criteria, detail):
    """``head`` and then its results as JSON text, about CHUNK_BYTES at a time."""
    yield orjson.dumps(head)[:-1] + b',"results":['
    if listing is not None:
        buffer, first = bytearray(), True
        for study in _studies(listing, criteria, detail):
            buffer += (b"" if first else b",") + orjson.dumps(study)
            first = False
            if len(buffer) >= CHUNK_BYTES:
                yield bytes(buffer)
                buffer.clear()
        if buffer:
            yield bytes(buffer)
    yield b"]}"


def _studies(listing, criteria, detail):
    """Each listed study, read through a server-side cursor on a connection of its own:
    the response outlives the request's session."""
    provenance = _matched_by(criteria)
    features = detail == "features"
    with db.engine.connect() as connection:
        # A cursor is planned for its first tenth by default; this one is read to the end.
        connection.exec_driver_sql("SET LOCAL cursor_tuple_fraction = 1")
        rows = connection.execution_options(stream_results=True, yield_per=BATCH_ROWS)
        rows = rows.execute(listing).mappings()
        if detail == "studies":
            for row in rows:
                yield {"study": row["study_id"], "base_study": row["base_study_id"]}
            return
        for (base_study, study), group in groupby(
            rows, key=lambda row: (row["base_study_id"], row["study_id"])
        ):
            yield {
                "study": study,
                "base_study": base_study,
                "analyses": [_analysis(row, provenance, features) for row in group],
            }


#: Term listing field -> the criterion whose values it lists.
TERM_FIELDS = {
    "medical_condition": "medical_condition",
    "task": "task",
    "contrast_key": "contrast.key",
    "contrast_set": "contrast.set",
    "arm_kind": "design.arm_kind",
    "contrast_positive_facet": "contrast.positive.facet",
    "contrast_negative_facet": "contrast.negative.facet",
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
#: The fields whose terms `analysis_terms` labels and places under a parent, and the field
#: each one's children are listed under.
CHILD_FIELDS = {
    "medical_condition": "medical_condition",
    "task": "task",
    "task_family": "task",
    "contrast_key": "contrast_key",
    "contrast_set": "contrast_set",
}


def _term_column(field):
    """The column whose values the terms field ``field`` lists."""
    if field == "task_family":
        return AF.task_family_ids
    criterion = FIELDS[TERM_FIELDS[field]]
    return criterion.ids if criterion.ids is not None else criterion.column


def _children(field, values):
    """``{term: [the terms directly under it]}`` for ``values`` of ``field``."""
    children = {}
    for parent, term in db.session.execute(
        sa.select(AT.parent, AT.term)
        .where(AT.field == CHILD_FIELDS[field], AT.parent.in_(values))
        .order_by(AT.term)
    ):
        children.setdefault(parent, []).append(term)
    return children


def unnested(column, name):
    """``column``'s array items as a table ``name`` with one column, ``value``."""
    return sa.func.unnest(column).table_valued("value").render_derived(name=name)


def list_terms(field, search=None, limit=50, parent=None):
    """The values ``field`` takes, with how many analyses and papers carry each, and each
    one's label, parent, children and synonyms (a loaded release's, for a medical
    condition); ``search`` matches the value, label or a synonym."""
    if field not in TERM_FIELDS and field != "task_family":
        abort_validation(
            "Unknown term field.",
            [make_field_error("field", field, sorted([*TERM_FIELDS, "task_family"]))],
        )
    column = _term_column(field)
    if isinstance(column.type, sa.ARRAY):
        items = unnested(column, "t")
        source = sa.select().select_from(AF).join(items, sa.true())
        value = items.c.value
    else:
        source = sa.select().select_from(AF).where(column.is_not(None))
        value = column
    counts = (
        source.add_columns(
            value.label("value"),
            sa.func.count().label("analyses"),
            sa.func.count(AF.base_study_id.distinct()).label("base_studies"),
        )
        .group_by(value)
        .subquery()
    )
    statement = sa.select(counts.c.value, counts.c.analyses, counts.c.base_studies)
    synonyms = sa.null()
    # Medical conditions have a loaded release's labels and synonyms.
    concepts = field == "medical_condition"
    if field in CHILD_FIELDS:
        label = sa.func.coalesce(AT.label, counts.c.value)
        statement = statement.add_columns(AT.parent).outerjoin(
            AT, sa.and_(AT.field == field, AT.term == counts.c.value)
        )
        if concepts:
            label = sa.func.coalesce(AT.label, Concept.label, counts.c.value)
            synonyms = Concept.synonyms
            statement = statement.outerjoin(Concept, Concept.concept_id == counts.c.value)
        if parent:
            statement = statement.where(AT.parent == parent)
    else:
        label = counts.c.value
        statement = statement.add_columns(sa.null().label("parent"))
        if parent:
            statement = statement.where(sa.false())
    statement = statement.add_columns(label.label("label"), synonyms.label("synonyms"))
    if search:
        like = f"%{search.lower()}%"
        matches = [sa.func.lower(counts.c.value).like(like), sa.func.lower(label).like(like)]
        if concepts:
            matches.append(sa.func.lower(sa.func.array_to_string(synonyms, " | ")).like(like))
        statement = statement.where(sa.or_(*matches))
    statement = statement.order_by(sa.desc(counts.c.analyses), counts.c.value).limit(limit)
    rows = [row._asdict() for row in db.session.execute(statement)]
    children = _children(field, [r["value"] for r in rows]) if field in CHILD_FIELDS else {}
    return [
        {**row, "children": children.get(row["value"], []), "synonyms": row["synonyms"] or []}
        for row in rows
    ]
