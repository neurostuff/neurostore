"""study_schema helpers shared by the ingester and the review core; none touches the database."""

import hashlib
import json
from functools import cache

from jsonschema import validators
from study_schema import keys
from study_schema.jsonschema import load, unique_keys
from study_schema.models.paper_parse import ParsedAnalysis

#: The lists of each class whose items are entities of their own, as
#: (dotted path within the owner, class of its items). Every acquisition
#: modality (MRI, EEG, ...) is an Acquisition.
CHILD_LISTS = {
    "Study": (
        ("groups", "Group"),
        ("tasks", "Task"),
        ("assessments", "Assessment"),
        ("regions", "Region"),
        ("devices", "Device"),
        ("acquisitions", "Acquisition"),
        ("preprocessings", "Preprocessing"),
        ("model_estimations", "ModelEstimation"),
        ("inference_settings", "InferenceSettings"),
        ("measures", "Measure"),
        ("tables", "Table"),
        ("analyses", "Analysis"),
        ("coordinate_sets", "CoordinateSet"),
        ("design.arms", "Arm"),
        ("design.timepoints", "Timepoint"),
    ),
    "Task": (("conditions", "Condition"),),
    "ModelEstimation": (("terms", "ModelTerm"),),
}

#: The slots of each storage class's first unique key, which selectors use: the only nested
#: lists a claim path may index.
DECLARED_KEYS = {cls: slots[0] for cls, slots in unique_keys("storage-study").items()}


@cache
def _validator(name):
    schema = load(name)
    return validators.validator_for(schema)(schema)


def schema_errors(name, document):
    """The errors of ``document`` against study_schema's ``name`` schema, sorted by path."""
    return sorted(_validator(name).iter_errors(document), key=lambda e: list(e.path))


def schema(name):
    """The schema of study_schema's ``name`` document, as study_schema loads it."""
    return _validator(name).schema


def subschema_errors(name, subschema, instance):
    """The errors of ``instance`` against ``subschema``, a part of study_schema's ``name``
    schema whose $refs resolve within it."""
    return _validator(name).evolve(schema=subschema).iter_errors(instance)


def expected_key(analysis):
    """The content key a coordinate-parse analysis's name, space and points give."""
    return keys.key_for(ParsedAnalysis.model_validate(analysis))


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def sha256_of(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def refs(schema):
    """The $defs names a property schema can hold."""
    out = []
    if "$ref" in schema:
        out.append(schema["$ref"].rsplit("/", 1)[-1])
    for option in schema.get("anyOf", []):
        out.extend(refs(option))
    return out


def is_extracted(defs, name):
    props = defs.get(name, {}).get("properties", {})
    return "extraction_status" in props and "evidence" in props


def pick(defs, names, value):
    """The class among ``names`` that ``value`` is an instance of.

    A class whose property fixes a key the value holds to the value's own value wins outright;
    otherwise the first class whose required keys and properties fit the value, and that no
    fixed property contradicts; otherwise the first class.
    """
    classes = [n for n in names if defs.get(n, {}).get("type") == "object"]
    for name in classes:
        if _pins(defs[name].get("properties", {}), value):
            return name
    for name in classes:
        props = defs[name].get("properties", {})
        required = defs[name].get("required", [])
        if (
            all(r in value for r in required)
            and set(value) <= set(props)
            and not any(_contradicts(props[k], value[k]) for k in value)
        ):
            return name
    return classes[0] if classes else None


def _fixed(schema):
    """The one value a property schema fixes (by const or a single-member enum), as a list."""
    allowed = [schema["const"]] if "const" in schema else schema.get("enum")
    return allowed if allowed is not None and len(allowed) == 1 else None


def _pins(props, value):
    return any(k in value and _fixed(schema) == [value[k]] for k, schema in props.items())


def _contradicts(schema, value):
    fixed = _fixed(schema)
    return fixed is not None and fixed != [value]


def class_of(defs, schema, value):
    """The class among those property ``schema`` holds, directly or as its items, that
    ``value`` is an instance of."""
    names = refs(schema)
    names.extend(refs(schema.get("items", {})))
    return pick(defs, names, value)


def minimal(defs, schema, string=""):
    """The least value ``schema`` allows: each ExtractedValue not_reported, each object its
    required properties, each list its fewest items, each string ``string``."""
    while "$ref" in schema:
        schema = defs[schema["$ref"].rsplit("/", 1)[-1]]
    if "anyOf" in schema:
        options = [o for o in schema["anyOf"] if o.get("type") != "null"]
        return minimal(defs, options[0], string) if options else None
    props = schema.get("properties", {})
    if "extraction_status" in props and "evidence" in props:
        return {"extraction_status": "not_reported", "evidence": {"status": "not_applicable"}}
    kind = schema.get("type")
    kind = [k for k in kind if k != "null"][0] if isinstance(kind, list) else kind
    if "enum" in schema:
        return schema["enum"][0]
    if kind == "object" or props:
        return {name: minimal(defs, props[name], string) for name in schema.get("required", [])}
    if kind == "array":
        return [minimal(defs, schema["items"], string) for _ in range(schema.get("minItems", 0))]
    if kind == "string":
        return string
    if kind in ("integer", "number"):
        return schema.get("minimum", 1)
    if kind == "boolean":
        return False
    return None


def extracted_value(wrapper):
    """The value of an ExtractedValue (or a bare value)."""
    return wrapper.get("value") if isinstance(wrapper, dict) else wrapper


def item_path(owner_path, list_path, index=None):
    """Where a list of an owner (or, given ``index``, one of its items) sits in a record."""
    path = f"{owner_path}.{list_path}" if owner_path else list_path
    return path if index is None else f"{path}[{index}]"


def entity_lists(record):
    """``(owner path, list path, entity class, items)`` for each CHILD_LISTS list of the
    study ``record`` (owner path "") and, below it, of each object item of a list.

    ``items`` is whatever the record holds there (None when absent). The object items of
    a list are walked before the owner's next list.
    """

    def walk(owner_class, owner_path, owner):
        for list_path, entity_class in CHILD_LISTS.get(owner_class, ()):
            items = _get(owner, list_path)
            yield owner_path, list_path, entity_class, items
            if not isinstance(items, list):
                continue
            for index, item in enumerate(items):
                if isinstance(item, dict):
                    yield from walk(entity_class, item_path(owner_path, list_path, index), item)

    yield from walk("Study", "", record)


def _get(obj, dotted):
    for part in dotted.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj
