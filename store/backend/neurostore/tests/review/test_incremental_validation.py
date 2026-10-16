"""Validating only what a batch changed refuses exactly the batches, with exactly the problems
and failing op, that validating the whole documents does.

This is where incremental validation is checked against full validation."""

import collections
import copy
import random

import pytest

from neurostore.review.core import defs, entities, paths, references, validation
from neurostore.review.core.ops import (
    OpError, ReviewState, apply_batch, full_problems, incremental_problems,
)
from neurostore.study_schema_tools import CHILD_LISTS, DECLARED_KEYS, schema_errors
from neurostore.tests import study_schema_fixtures as fx
from neurostore.tests.review import records

AT = "2026-10-15T12:00:00Z"
MODES = {"full": full_problems, "incremental": incremental_problems}
SEEDS = 150


def _two_groups():
    """golden() with an_1 reading a second group, so a keyed selector can pick an item past the
    first of its list."""
    record = records.golden()
    record["analyses"][0]["groups"].append({"group": "grp_b", "n": fx.extracted(18)})
    return record


STARTS = {
    "golden": records.golden,
    "hidden_reach": records.hidden_reach,
    "subclasses": records.subclasses,
    "two_groups": _two_groups,
}
#: The schema class a new entity of each CHILD_LISTS class is made from.
MADE_AS = {"Acquisition": ("MRI", "EEG", "PET", "FNIRS", "OtherModality")}
VALUES = ("text", 7, 2.5, -3, True, None, ["a"], {"x": 1}, "", 0)
KEPT = {"applied": 1, "invalid": 1 / 3, "cannot apply": 1 / 10}
ROLES = ("result", "anchor", "localization", "reference", "other")
#: The schema slots checked whole, as anyOf, and the kinds of refused part a batch can leave.
ANYOF_SLOTS = ("design", "acquisitions", "effect")
KINDS = (
    "entity part", "anyOf slot", "whole entity", "list membership", "revision new", "revision key",
)
KIND_FLOOR = 1


def _refusal_kind(op, problem):
    """The kind of part that ``op`` leaves invalid, by the document and the op's type."""
    if problem.startswith("coordinate-parse"):
        return "revision new" if op.get("action") in ("add", "split", "merge") else "revision key"
    if op["type"] == "create_entity":
        return "whole entity"
    if op["type"] in ("link", "unlink", "delete_entity", "coordinate"):
        return "list membership"
    if op["target"].get("path", "").split(".")[0] in ANYOF_SLOTS:
        return "anyOf slot"
    return "entity part"


def _outcome(mode, state, batch):
    try:
        after, stored = apply_batch(
            state, batch, text=records.TEXT, user_id="u1", at=AT, validate=MODES[mode]
        )
    except OpError as error:
        return "refused", str(error), error.failures
    documents = (after.record, after.coordinate_revision, after.provenance, after.annotations)
    return "applied", documents, stored


def _validates(state):
    revision = state.coordinate_revision
    return schema_errors("extraction-record", state.record) == [] and (
        revision is None or schema_errors("coordinate-parse", revision) == []
    )


def _start(rng, name):
    """A start of ``name``'s record, with or without a revision, and with a parse whose
    revisions carry a field coordinate-parse refuses a quarter of the time."""
    state = ReviewState(record=STARTS[name](), coordinate_parse=records.coordinate_parse())
    if rng.random() < 0.4:
        keys = [a["key"] for a in state.coordinate_parse["analyses"]]
        state, _ = apply_batch(state, {"ops": [
            _op("verdict", target=_analysis(keys[0]), verdict="accept"),
            _op("coordinate", target=_analysis(keys[2]), action="relabel", role="other"),
        ]}, text=records.TEXT, user_id="u0", at=AT, validate=full_problems)
    if rng.random() < 0.25:
        state.coordinate_parse = {**state.coordinate_parse, "tables": "not a list"}
    return state


_ids = collections.Counter()


def _op(kind, **fields):
    _ids[kind] += 1
    return {"client_op_id": f"prop-{kind}-{_ids[kind]:06d}", "type": kind, **fields}


def _analysis(key):
    return {"kind": "coordinate_analysis", "analysis_key": key}


class _Ops:
    """Random ops on a state, each kind valid or not, read from the state as it is."""

    def __init__(self, rng, state):
        self.rng, self.state = rng, state
        self.index = entities.index(state.record)
        current = (state.coordinate_revision or state.coordinate_parse)["analyses"]
        self.analyses = current or state.coordinate_parse["analyses"]

    def any(self):
        kind = self.rng.choice([
            "verdict", "note", "set_value", "set_value", "set_value", "set_evidence", "link",
            "unlink", "create_entity", "create_entity", "delete_entity", "coordinate",
            "coordinate",
        ])
        return getattr(self, kind)()

    def entity(self):
        return self.rng.choice(list(self.index.values()))

    def slot_path(self, entity):
        """A path to one of the entity's values, one through a list item when it has any, or
        a path that is not one."""
        found = list(_wrapper_paths(entity.item, entity.entity_class))
        selected = [path for path in found if "[" in path]
        if selected and self.rng.random() < 0.5:
            return self.rng.choice(selected)
        return self.rng.choice(found + ["bogus_slot", "name.value", "groups[#7].n"])

    def target(self):
        kind = self.rng.choice(["slot", "entity", "relationship", "coordinate_analysis"])
        entity = self.entity()
        if kind == "slot":
            return {"kind": "slot", "entity": entity.local_id, "path": self.slot_path(entity)}
        if kind == "entity":
            return {"kind": "entity", "entity": self.rng.choice([entity.local_id, "nope_1"])}
        if kind == "relationship":
            return self.relationship(entity)
        return _analysis(self.rng.choice(self.analyses)["key"])

    def relationship(self, entity):
        rows = [r for r in references.reference_slots()
                if r["class"] in (entity.entity_class, entity.schema_class)]
        path = self.rng.choice(rows)["slot"] if rows else "regions"
        target = self.entity().local_id
        return {"kind": "relationship", "entity": entity.local_id, "path": path,
                "target_entity": target}

    def verdict(self):
        return _op("verdict", target=self.target(),
                   verdict=self.rng.choice(["accept", "reject"]))

    def note(self):
        return _op("note", target=self.target(), note="checked")

    def set_value(self):
        analyses = [e for e in self.index.values() if e.entity_class == "Analysis"]
        entity = self.rng.choice(analyses) if analyses and self.rng.random() < 0.3 else (
            self.entity()
        )
        value = {"extraction_status": self.rng.choice(["extracted", "extracted", "not_reported"])}
        if value["extraction_status"] == "extracted":
            value["value"] = self.rng.choice(VALUES)
        elif self.rng.random() < 0.5:
            value["unreported_reason"] = "ambiguous"
        if self.rng.random() < 0.3:
            value["value_source"] = "reported"
        target = {"kind": "slot", "entity": entity.local_id, "path": self.slot_path(entity)}
        return _op("set_value", target=target, value=value)

    def set_evidence(self):
        target = self.target()
        if target["kind"] == "coordinate_analysis":
            target = {"kind": "entity", "entity": self.entity().local_id}
        start = self.rng.randrange(0, 40)
        end = self.rng.choice([start + 5, start, len(records.TEXT) + 3])
        sets = [{"spans": [{"start_char": start, "end_char": end}]}]
        status = self.rng.choice(["present", "present", "not_found", "not_applicable"])
        evidence = {"status": status, **({"sets": sets} if status == "present" else {})}
        return _op("set_evidence", target=target, evidence=evidence)

    def link(self):
        return _op("link", target=self.relationship(self.entity()))

    def unlink(self):
        entity = self.entity()
        linked = [
            ref for ref in references.references_in(self.index)
            if ref["entity"] == entity.local_id
        ]
        if linked and self.rng.random() < 0.8:
            ref = self.rng.choice(linked)
            target = {"kind": "relationship", "entity": ref["entity"], "path": ref["path"],
                      "target_entity": ref["target_entity"]}
        else:
            target = self.relationship(entity)
        return _op("unlink", target=target)

    def create_entity(self):
        owners = [e for e in self.index.values() if e.entity_class in CHILD_LISTS]
        parent = self.rng.choice(owners)
        list_path, cls = self.rng.choice(CHILD_LISTS[parent.entity_class])
        item = self.made(self.rng.choice(MADE_AS.get(cls, (cls,))))
        if self.rng.random() < 0.5:
            item.pop("local_id")
        fields = {"parent": parent.local_id, "list": list_path, "entity": item}
        if self.rng.random() < 0.3:
            fields["index"] = self.rng.randrange(0, 3)
        return _op("create_entity", **fields)

    def made(self, cls):
        """A new item of ``cls``, a time in three broken, its local_id new or taken."""
        item = fx.minimal(fx.defs[cls])
        breakage = self.rng.random()
        if breakage < 0.1 and len(item) > 1:
            del item[self.rng.choice([k for k in item if k != "local_id"])]
        elif breakage < 0.2:
            item["bogus_slot"] = 1
        elif breakage < 0.3:
            item[self.rng.choice(list(item))] = self.rng.choice(VALUES)
        item["local_id"] = self.rng.choice(["made_1", "made_2", self.entity().local_id])
        return item

    def delete_entity(self):
        return _op("delete_entity",
                   target={"kind": "entity", "entity": self.entity().local_id})

    def coordinate(self):
        rng = self.rng
        analysis = rng.choice(self.analyses)
        key = analysis["key"]
        action = rng.choice([
            "accept", "omit", "relabel", "edit_points", "split", "merge", "add", "restore",
        ])
        if action == "accept":
            return _op("verdict", target=_analysis(key), verdict="accept")
        if action == "omit":
            return _op("verdict", target=_analysis(key), verdict="reject", reason="duplicate")
        if action == "relabel":
            return _op("coordinate", target=_analysis(key), action=action,
                       role=rng.choice(ROLES))
        if action == "edit_points":
            points = [copy.deepcopy(p) for p in analysis["points"]]
            points.append(fx.point((rng.randrange(-60, 60), 4, 8)))
            payload = {"points": points}
            if rng.random() < 0.3:
                payload["name"] = f"renamed {rng.randrange(100)}"
            return _op("coordinate", target=_analysis(key), action=action, payload=payload)
        if action == "split":
            count = len(analysis["points"])
            parts = [{"indices": [0]}, {"indices": list(range(1, count))}] if count > 1 else [
                {"indices": [0]}, {"indices": [0]}]
            return _op("coordinate", target=_analysis(key), action=action,
                       payload={"parts": parts})
        if action == "merge":
            others = [a["key"] for a in self.analyses if a["key"] != key] or [key]
            return _op("coordinate", target=_analysis(key), action=action,
                       payload={"with": [rng.choice(others)]})
        if action == "restore":
            entity = {"index": rng.randrange(0, 3), "entity": self.made("Analysis")}
            payload = {"remove": [], "insert": [], "reasons": {},
                       "record": {"remove": [], "insert": [entity]}}
            return _op("coordinate", target={"kind": "coordinate_parse"}, action=action,
                       payload=payload)
        added = {
            "origin": "text",
            "text_spans": [{"start_char": 0, "end_char": 6}],
            "name": f"added {rng.randrange(1000)}",
            "coordinate_space": "MNI",
            "role": rng.choice(ROLES),
            "points": [fx.point((rng.randrange(-60, 60), 1, 2))],
        }
        return _op("coordinate", target={"kind": "coordinate_parse"}, action=action,
                   payload={"analysis": added})


def _wrapper_paths(item, entity_class, prefix=""):
    """The field paths of the ExtractedValues below an entity ``item``, not in its child
    entities."""
    children = {path.split(".")[0] for path, _ in CHILD_LISTS.get(entity_class, ())}
    for attribute, value in item.items():
        if not prefix and attribute in children and entity_class != "Study":
            continue
        path = f"{prefix}{attribute}"
        if isinstance(value, dict) and "extraction_status" in value:
            yield path
        elif isinstance(value, dict) and (entity_class != "Study" or attribute == "design"):
            yield from _wrapper_paths(value, entity_class, f"{path}.")
        elif isinstance(value, list) and entity_class != "Study":
            for position, element in enumerate(value):
                if isinstance(element, dict):
                    yield from _wrapper_paths(element, entity_class, f"{path}[#{position}].")
                    yield from _wrapper_paths(element, entity_class, f"{path}{_keyed(element)}.")


def _keyed(element):
    """The selector that picks ``element`` by the key slots of a class it has them all of."""
    for slots in DECLARED_KEYS.values():
        if all(slot in element for slot in slots):
            pairs = ",".join(f"{slot}={paths.key_value(element[slot])}" for slot in slots)
            return f"[{pairs}]"
    return "[#0]"


def _batch(rng, state):
    """A batch of one to eight ops, each read from the state the ops before it leave; of the
    ops drawn, one that leaves an invalid document there is kept a third of the time, and one
    that cannot apply there a tenth."""
    batch = []
    for _ in range(rng.randint(1, 8)):
        for _ in range(10):
            op = _Ops(rng, state).any()
            verdict, after = _verdict(state, op)
            if rng.random() < KEPT[verdict]:
                break
        batch.append(op)
        state = after or state
    return {"ops": batch}


def _verdict(state, op):
    """What applying ``op`` alone to ``state`` gives, and the state it leaves."""
    try:
        after, _ = apply_batch(
            state, {"ops": [op]}, text=records.TEXT, user_id="u1", at=AT, validate=full_problems
        )
    except OpError as error:
        return ("invalid" if "invalid document" in str(error) else "cannot apply"), None
    return "applied", after


@pytest.mark.parametrize("start", STARTS)
def test_incremental_validation_refuses_exactly_what_full_validation_refuses(start):
    verdicts, mismatches = collections.Counter(), []
    for seed in range(SEEDS):
        rng = random.Random(f"{start}-{seed}")
        state = _start(rng, start)
        assert _validates(state)
        batch = _batch(rng, state)
        outcomes = {mode: _outcome(mode, state, batch) for mode in MODES}
        if len({repr(outcome) for outcome in outcomes.values()}) != 1:
            mismatches.append((seed, outcomes))
        kind, *refusal = outcomes["full"]
        verdicts["invalid" if "invalid document" in str(refusal) else kind] += 1
    assert mismatches == []
    assert verdicts["invalid"] >= SEEDS // 8, verdicts
    assert verdicts["applied"] >= SEEDS // 8, verdicts


def _refused_kinds(start):
    """The kinds of part the seeded batches of ``start`` leave invalid, as full validation
    refuses them."""
    kinds = collections.Counter()
    for seed in range(SEEDS):
        rng = random.Random(f"{start}-{seed}")
        state = _start(rng, start)
        batch = _batch(rng, state)
        _, *refusal = _outcome("full", state, batch)
        if "invalid document" in str(refusal):
            index, problem = refusal[1][0]
            kinds[_refusal_kind(batch["ops"][index], problem)] += 1
    return kinds


def test_every_kind_of_invalid_part_is_generated():
    kinds = sum((_refused_kinds(start) for start in STARTS), collections.Counter())
    assert all(kinds[kind] >= KIND_FLOOR for kind in KINDS), kinds


def test_a_batch_is_validated_only_where_it_changed_the_documents():
    record = records.golden()
    record["regions"][0]["bogus_slot"] = 1
    rename = _op("set_value", target={"kind": "slot", "entity": "grp_b", "path": "name"},
                 value={"extraction_status": "extracted", "value": "siblings"})
    after, _ = apply_batch(ReviewState(record=record), {"ops": [rename]}, text=records.TEXT,
                           user_id="u1", at=AT)
    assert after.record["groups"][1]["name"]["value"] == "siblings"


@pytest.mark.parametrize("break_it, deep, own", [
    (lambda parse: parse["analyses"][0]["points"][0].update(coordinates=[1, 2]),
     [], [("analyses", 0, "points", 0, "coordinates")]),
    (lambda parse: parse["analyses"][0].pop("name"), [("analyses", 0, "name")], []),
])
def test_the_owners_of_a_changed_part_are_checked_for_their_own_keywords(break_it, deep, own):
    parse = records.coordinate_parse()
    break_it(parse)
    problems = validation.changed_problems("coordinate-parse", parse, deep, own)
    assert problems == validation.document_problems("coordinate-parse", parse)
    assert len(problems) == 1


def _revision(edit):
    """``(before, after)``: a coordinate parse and a revision of it that ``edit`` makes."""
    before = records.coordinate_parse()
    after = copy.deepcopy(before)
    edit(after)
    return before, after


def _replaced_problems(before, after):
    """The revision's problems, which must be those of validating the whole revision."""
    problems = validation.replaced_problems("coordinate-parse", before, after)
    assert problems == validation.document_problems("coordinate-parse", after)
    return problems


def test_a_revision_appending_an_analysis_with_a_bad_point_reports_that_point():
    def append_bad_point(parse):
        added = copy.deepcopy(parse["analyses"][0])
        added["points"][0]["coordinates"] = [1, 2]
        parse["analyses"].append(added)

    problems = _replaced_problems(*_revision(append_bad_point))
    assert len(problems) == 1
    assert problems[0].startswith("coordinate-parse /analyses/3/points/0/coordinates:")


def test_a_revision_without_its_parse_id_reports_it():
    def drop_parse_id(parse):
        del parse["parse_id"]

    problems = _replaced_problems(*_revision(drop_parse_id))
    assert len(problems) == 1
    assert problems[0].startswith("coordinate-parse /: ")
    assert "'parse_id' is a required property" in problems[0]


def test_a_revision_changing_a_header_reports_the_bad_value_below_it():
    def bad_producer_version(parse):
        parse["header"]["producer"]["version"] = 7

    problems = _replaced_problems(*_revision(bad_producer_version))
    assert len(problems) == 1
    assert problems[0].startswith("coordinate-parse /header/producer/version:")


LENGTH_KEYWORDS = {"minItems", "maxItems", "uniqueItems", "contains", "minContains", "maxContains"}


def _class_named(schema):
    """The class a property schema refers to, directly or as an option of an anyOf."""
    refs = [schema, *schema.get("anyOf", ())]
    return next(option["$ref"] for option in refs if "$ref" in option).rsplit("/", 1)[-1]


def test_no_entity_list_is_constrained_by_its_length():
    """So adding or removing an entity can invalidate a record only through the entity itself,
    and a batch that changes a list's membership needs only its owner's own keywords checked."""
    schemas = defs.extraction_defs()
    for cls, entries in CHILD_LISTS.items():
        for path, _ in entries:
            owner = cls
            *parents, attribute = path.split(".")
            for parent in parents:
                owner = _class_named(schemas[owner]["properties"][parent])
            schema = schemas[owner]["properties"][attribute]
            assert LENGTH_KEYWORDS.isdisjoint(schema), (cls, path, schema)
