"""The schema class of every entity and nested object of the golden records, as the front end's
schema walk must reproduce it (D53).

Regenerate the golden file with:
UPDATE_GOLDEN=1 python -m pytest neurostore/tests/review/test_slot_classes.py
"""

import json
import os

from neurostore.review import defs, entities, paths
from neurostore.study_schema_tools import CHILD_LISTS, DECLARED_KEYS
from neurostore.tests.review import golden, records

GOLDEN = golden.ROOT / "review-frontend/src/test/golden/slot-classes.json"
REGENERATE = (
    "regenerate it with: cd store/backend && UPDATE_GOLDEN=1 python -m "
    "pytest neurostore/tests/review/test_slot_classes.py"
)
RECORDS = {
    "golden": lambda: golden.build_bundle()["record"],
    "hidden_reach": records.hidden_reach,
    "subclasses": records.subclasses,
}


def walk(record):
    """{"classes": [{entity, path, class}], "wrappers": [{entity, path, class}]} for the
    record's entities and every object below them, in record order.

    An entity's own list children are entities of their own, so they are not walked
    under it. A value wrapper is listed as an object and is not walked below.
    """
    classes, wrappers = [], []
    for local_id, entity in entities.index(record).items():
        classes.append({"entity": local_id, "path": "", "class": entity.schema_class})
        skip = {path for path, _ in CHILD_LISTS.get(entity.entity_class, ())}
        _walk(entity.schema_class, entity.item, (), local_id, skip, classes, wrappers)
    return {"classes": classes, "wrappers": wrappers}


def _walk(cls, obj, steps, local_id, skip, classes, wrappers):
    for attribute, value in obj.items():
        here = (*steps, (attribute, None))
        if value is None or ".".join(a for a, _ in here) in skip:
            continue
        if isinstance(value, dict):
            inner = defs.class_of(cls, attribute, value)
            if inner is None:
                continue
            _found(local_id, here, inner, classes, wrappers)
            if not defs.is_extracted(inner):
                _walk(inner, value, here, local_id, skip, classes, wrappers)
        elif isinstance(value, list):
            for position, item in enumerate(value):
                if not isinstance(item, dict):
                    continue
                inner = defs.class_of(cls, attribute, item)
                if inner is None:
                    continue
                slots = DECLARED_KEYS.get(inner)
                selector = (
                    tuple((s, paths.key_value(item.get(s))) for s in slots)
                    if slots else position
                )
                step = (*steps, (attribute, selector))
                _found(local_id, step, inner, classes, wrappers)
                if not defs.is_extracted(inner):
                    _walk(inner, item, step, local_id, skip, classes, wrappers)


def _found(local_id, steps, cls, classes, wrappers):
    row = {"entity": local_id, "path": paths.format_path(steps), "class": cls}
    classes.append(row)
    if defs.is_extracted(cls):
        wrappers.append(row)


def _class(document, local_id, path):
    rows = [r for r in document["classes"] if r["entity"] == local_id and r["path"] == path]
    assert len(rows) == 1, f"{local_id!r} {path!r} has {len(rows)} rows"
    return rows[0]["class"]


def test_the_slot_classes_match_the_golden_file():
    document = {}
    for name, build in RECORDS.items():
        record = build()
        document[name] = {"record": record, **walk(record)}
    rendered = json.dumps(document, indent=2, ensure_ascii=False) + "\n"
    if os.environ.get("UPDATE_GOLDEN") == "1":
        GOLDEN.write_text(rendered, encoding="utf-8")
    assert GOLDEN.exists(), f"{GOLDEN} is missing; {REGENERATE}"
    assert GOLDEN.read_text("utf-8") == rendered, f"slot-classes.json is stale; {REGENERATE}"


def test_a_subclass_is_picked_over_the_first_branch_of_its_any_of():
    document = walk(records.subclasses())
    assert _class(document, "an_1", "details") == "ConnectivityDetails"
    assert _class(document, "acq_1", "") == "MRI"
    assert _class(document, "acq_2", "") == "EEG"
    assert _class(document, "acq_3", "") == "PET"


def test_a_bare_subclass_with_only_its_required_keys_resolves_to_its_own_class():
    document = walk(records.subclasses())
    assert _class(document, "acq_4", "") == "EEG"


def test_a_value_wrapper_is_listed_with_its_def_name():
    document = walk(golden.build_bundle()["record"])
    wrapper = next(
        r for r in document["wrappers"] if r["entity"] == "grp_a" and r["path"] == "age_mean"
    )
    assert wrapper["class"] in defs.extraction_defs()
    assert defs.is_extracted(wrapper["class"])
    assert all(defs.is_extracted(r["class"]) for r in document["wrappers"])
