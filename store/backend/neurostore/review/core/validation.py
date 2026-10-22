"""The problems of review documents, found in the parts a batch changed.

A batch starts from documents that validate, so the problems of the documents it leaves are
the problems of the parts it changed. Each part is validated against the sub-schema its
document's schema applies there, and a problem reads as validating the whole document reports
it: "<schema name> /<path in the document>: <message>".

A location is the path to a part of a document, a tuple of property names and list indexes. A
part is checked deep (everything below it) or for its own keywords only (its type, required
properties, item count and the like), its properties and items allowed whatever they hold.
"""

from dataclasses import dataclass, field

from jsonschema.exceptions import best_match

from neurostore.review.core import entities
from neurostore.study_schema_tools import schema, schema_errors, subschema_errors

#: Keywords that judge an instance by itself, or hand each property or item to one sub-schema.
OWN_KEYWORDS = {
    "type", "enum", "const", "required", "additionalProperties", "properties", "items",
    "minItems", "maxItems", "uniqueItems", "minProperties", "maxProperties", "minimum",
    "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength",
    "maxLength", "pattern", "format",
}
ANNOTATIONS = {
    "$id", "$schema", "$defs", "$comment", "title", "description", "default", "examples",
    "deprecated", "readOnly", "writeOnly", "metamodel_version", "version",
}
LOCAL_REF = "#/$defs/"
_ABSENT = object()


@dataclass
class RecordChanges:
    """What ops changed in an extraction record: parts of entities (the study's included),
    each an entity's local_id and the location of the part below it, everything below the part
    included; and the entity lists whose items were added or removed, by owner's local_id and
    list path."""

    parts: set = field(default_factory=set)
    lists: set = field(default_factory=set)

    def part(self, local_id, below=()):
        self.parts.add((local_id, below))

    def membership(self, owner, list_path):
        self.lists.add((owner, list_path))


def document_problems(name, document):
    """The problems of the whole ``document`` against study_schema's ``name`` schema."""
    return [_problem(name, (), error) for error in schema_errors(name, document)]


def record_problems(index, changes):
    """The problems of the extraction record after ops that made ``changes`` to it, ``index``
    being the record's entity index after them."""
    deep = [
        (*index[local_id].location, *below)
        for local_id, below in changes.parts
        if local_id in index
    ]
    own = [
        (*index[local_id].location, *list_path.split("."))
        for local_id, list_path in changes.lists
        if local_id in index
    ]
    return changed_problems("extraction-record", index[entities.STUDY].item, deep, own)


def replaced_problems(name, before, after):
    """The problems of the ``name`` document ``after``, which replaced ``before`` (None when
    there was none, or is none now)."""
    if after is None or after is before:
        return []
    if before is None:
        return document_problems(name, after)
    deep, own = [], [()]
    for key, value in after.items():
        old = before.get(key, _ABSENT)
        if value == old:
            continue
        if isinstance(value, list) and isinstance(old, list):
            own.append((key,))
            deep.extend((key, index) for index in _new_items(value, old))
        else:
            deep.append((key,))
    return changed_problems(name, after, deep, own)


def changed_problems(name, document, deep, own=()):
    """The problems of ``document`` in its parts at the ``deep`` locations and in the own
    keywords of its parts at the ``own`` locations, the rest of it being valid."""
    plan = _planned(name, deep, own)
    found = []
    for location, (subschema, deep_here) in plan.items():
        if any(plan[location[:end]][1] for end in range(len(location))):
            continue
        instance = _at(document, location)
        if instance is _ABSENT:
            continue
        if not deep_here:
            subschema = _own(_resolved(name, subschema))
        found.extend(
            (location, error) for error in subschema_errors(name, subschema, instance)
        )
    found.sort(key=lambda pair: [*pair[0], *pair[1].path])
    return [_problem(name, location, error) for location, error in found]


def where(error, location=()):
    """The path of the part ``error`` is about, below ``location`` in its document."""
    return "/".join(str(part) for part in (*location, *error.absolute_path))


def _problem(name, location, error):
    error = best_match([error])
    return f"{name} /{where(error, location)}: {error.message}"


def _planned(name, deep, own):
    """``{location: (sub-schema, deep)}``: each location a problem may be at, the sub-schema
    its part is judged by there, and whether it is judged deep there."""
    plan = {}
    for locations, wanted in ((deep, True), (own, False)):
        for location in locations:
            chain, unlisted_step = _reach(name, location)
            reached, subschema = chain[-1]
            if unlisted_step:
                here = False
            elif reached != location:
                here = True
            else:
                here = wanted or not _checks_by_property(_resolved(name, subschema))
            for part, part_schema in chain:
                plan.setdefault(part, (part_schema, False))
            plan[reached] = (subschema, plan[reached][1] or here)
    return plan


def _reach(name, location):
    """``(chain, unlisted_step)``: the (location, sub-schema) of each leading part of
    ``location`` that its owner's ``properties`` or ``items`` give, from the root; and whether
    the walk stopped at a step its owner gives no sub-schema to, rather than at an owner that
    judges its items by their own keywords alone."""
    subschema, reached = schema(name), ()
    chain = [(reached, subschema)]
    for step in location:
        owner = _resolved(name, subschema)
        if not _checks_by_property(owner):
            return chain, False
        if isinstance(step, str):
            child = owner.get("properties", {}).get(step)
        else:
            child = owner.get("items")
        if child is None:
            return chain, True
        subschema, reached = child, (*reached, step)
        chain.append((reached, subschema))
    return chain, False


def _resolved(name, subschema):
    """``subschema`` with each $ref that is all it holds followed."""
    defs = schema(name)["$defs"]
    while (
        isinstance(subschema, dict)
        and set(subschema) - ANNOTATIONS == {"$ref"}
        and subschema["$ref"].startswith(LOCAL_REF)
    ):
        subschema = defs[subschema["$ref"][len(LOCAL_REF):]]
    return subschema


def _checks_by_property(subschema):
    """Whether ``subschema`` judges an instance by its own keywords and hands each property
    and item to one sub-schema."""
    return (
        isinstance(subschema, dict)
        and set(subschema) <= OWN_KEYWORDS | ANNOTATIONS
        and isinstance(subschema.get("additionalProperties", False), bool)
        and isinstance(subschema.get("items", {}), (dict, bool))
    )


def _own(subschema):
    """``subschema`` with each of its properties and items allowed whatever it holds."""
    own = dict(subschema)
    if "properties" in own:
        own["properties"] = dict.fromkeys(own["properties"], True)
    if "items" in own:
        own["items"] = True
    return own


def _at(document, location):
    value = document
    for step in location:
        if isinstance(step, str) and isinstance(value, dict) and step in value:
            value = value[step]
        elif isinstance(step, int) and isinstance(value, list) and step < len(value):
            value = value[step]
        else:
            return _ABSENT
    return value


def _new_items(items, old):
    """The indexes of ``items`` not among ``old``."""
    return [i for i, item in enumerate(items) if item not in old]
