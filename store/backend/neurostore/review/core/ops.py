"""Apply review-ops batches to a ReviewState."""

import copy
import dataclasses
import hashlib
import json
from dataclasses import dataclass, field
from functools import cache

from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match

from neurostore.review.core import (
    SCHEMA_DIR, coordinates, entities, lists, paths, record_follow, references, validation,
)
from neurostore.review.core.targets import target_key
from neurostore.review.errors import ReviewError
from neurostore.study_schema_tools import CHILD_LISTS

OPS_SCHEMA = SCHEMA_DIR / "review-ops.schema.json"
#: The fields of an ExtractedValue a set_value op writes, as a group.
VALUE_FIELDS = ("extraction_status", "value", "value_source", "unreported_reason")
#: Exists only so the 422 for a coordinate verdict can name the verdict op.
COORDINATE_JUDGEMENTS_REFUSED = ("accept", "omit", "reject")
#: Evidence that clears an entity's or a relationship's annotation.
NO_EVIDENCE = {"status": "not_applicable"}
#: The op types no inverse undoes.
NO_INVERSE = {"note"}


class OpError(ReviewError):
    """A refused batch; ``failures`` holds (op index or None, problem) for each problem."""

    def __init__(self, message, failures):
        super().__init__(message, [_prefixed(index, problem) for index, problem in failures])
        self.failures = failures


def _prefixed(index, problem):
    return problem if index is None else f"op {index}: {problem}"


@dataclass
class ReviewState:
    record: dict
    coordinate_parse: dict | None = None
    coordinate_revision: dict | None = None
    #: review-bundle Provenance by target key: {state, user_id, at}.
    provenance: dict = field(default_factory=dict)
    #: review-bundle annotations by target key: evidence for an entity or a relationship.
    annotations: dict = field(default_factory=dict)
    last_seq: int = 0


def incremental_problems(state, changed, revision_before):
    """The problems of ``state``'s documents after ops that replaced the coordinate revision
    ``revision_before`` and made ``changed`` to its record; the documents before them validated.

    ``changed`` is a (changes, entity index) pair.
    """
    changes, index = changed
    return validation.record_problems(index, changes) + validation.replaced_problems(
        "coordinate-parse", revision_before, state.coordinate_revision
    )


def full_problems(state, changed=None, revision_before=None):
    """The problems of ``state``'s whole documents; ``changed`` and ``revision_before`` are
    unused, so that it stands in for incremental_problems."""
    problems = validation.document_problems("extraction-record", state.record)
    if state.coordinate_revision is not None:
        problems += validation.document_problems("coordinate-parse", state.coordinate_revision)
    return problems


def apply_batch(state, batch, *, text, user_id, at, validate=incremental_problems):
    """``(new state, stored ops)`` for ``batch`` applied in order to a copy of ``state``.

    ``state``'s documents must validate, as those of every state a batch leaves do.
    ``validate(state, changed, revision_before)`` gives the problems of the documents the ops
    leave, as ``changed`` and ``revision_before`` describe the batch: incremental_problems, the
    default, validates only the parts the batch changes, and full_problems the whole documents.

    Raises:
        ReviewError naming each failing op; the input state is never changed.
    """
    _check_batch(batch)
    ops = batch["ops"]
    after, stored, failures, changed = _apply(state, ops, text, user_id, at)
    if failures:
        indexes = sorted({index for index, _ in failures})
        named = ", ".join(str(index) for index in indexes)
        verb = "op" if len(indexes) == 1 else "ops"
        raise OpError(f"{verb} {named} cannot be applied", failures)
    if validate(after, changed, state.coordinate_revision):
        index, problems = _first_invalid_op(state, ops, text, user_id, at, validate)
        raise OpError(
            f"op {index} leaves an invalid document", [(index, problem) for problem in problems]
        )
    return after, stored


@cache
def _ops_schema():
    return json.loads(OPS_SCHEMA.read_text("utf-8"))


@cache
def _batch_validator():
    schema = _ops_schema()
    ops = {**schema["properties"]["ops"], "items": True}
    return Draft202012Validator({**schema, "properties": {**schema["properties"], "ops": ops}})


@cache
def _op_validator(name="Op"):
    return Draft202012Validator({"$defs": _ops_schema()["$defs"], "$ref": f"#/$defs/{name}"})


@cache
def _op_definitions():
    """The $defs name of each op type."""
    defs = _ops_schema()["$defs"]
    names = {}
    for branch in defs["Op"]["oneOf"]:
        name = branch["$ref"].rsplit("/", 1)[-1]
        kind = defs[name]["properties"]["type"]
        names.update((k, name) for k in kind.get("enum", [kind.get("const")]))
    return names


def _check_batch(batch):
    failures = [
        (None, f"batch: {error.message}") for error in _batch_validator().iter_errors(batch)
    ]
    seen = set()
    for index, item in enumerate(batch.get("ops") or ()):
        kind = item.get("type") if isinstance(item, dict) else None
        client_op_id = item.get("client_op_id") if isinstance(item, dict) else None
        if isinstance(client_op_id, str):
            if client_op_id in seen:
                failures.append((index, f"client_op_id {client_op_id} repeats an earlier op's"))
                continue
            seen.add(client_op_id)
        if kind == "coordinate" and item.get("action") in COORDINATE_JUDGEMENTS_REFUSED:
            failures.append((index, "accept and reject a coordinate analysis with a verdict op"))
            continue
        error = best_match(_op_validator(_op_definitions().get(kind, "Op")).iter_errors(item))
        if error is not None:
            path = validation.where(error)
            failures.append((index, f"{path}: {error.message}" if path else error.message))
    if failures:
        raise OpError("the batch does not validate against review-ops", failures)


def _apply(state, ops, text, user_id, at):
    """``(state, stored ops, failures, changed)``: each op that applies, in order, on the ops
    before it. An op that cannot apply is left out and named in ``failures`` as (index,
    problem); ``changed`` is then None.
    """
    work = _copy_state(state)
    applier = _Applier(work, text, user_id, at)
    stored, failures = [], []
    for index, op in enumerate(ops):
        try:
            before, after = applier.apply(op)
        except ReviewError as error:
            failures.extend((index, problem) for problem in error.problems)
            work = _replayed(state, [entry["op"] for entry in stored], text, user_id, at)
            applier = _Applier(work, text, user_id, at)
            continue
        work.last_seq += 1
        stored.append({
            "seq": work.last_seq,
            "op": copy.deepcopy(op),
            "before": before,
            "after": after,
            "user_id": user_id,
            "created_at": at,
        })
    return work, stored, failures, None if failures else applier.take_changes()


def _replayed(state, ops, text, user_id, at):
    """A copy of ``state`` with ``ops`` applied; the ops applied before a refused op, since the
    refused op may have part-changed the copy."""
    work = _copy_state(state)
    applier = _Applier(work, text, user_id, at)
    for op in ops:
        applier.apply(op)
        work.last_seq += 1
    return work


def _copy_state(state):
    """A copy of ``state`` for a batch to change. No op changes the coordinate parse, and a
    revision is replaced rather than changed, so both are shared with ``state``."""
    return dataclasses.replace(
        state,
        record=copy.deepcopy(state.record),
        provenance=copy.deepcopy(state.provenance),
        annotations=copy.deepcopy(state.annotations),
    )


def _first_invalid_op(state, ops, text, user_id, at, validate):
    """``(index, problems)`` of the first op after which the documents are invalid, or None
    when every op leaves them valid."""
    applier = _Applier(_copy_state(state), text, user_id, at)
    for index, op in enumerate(ops):
        revision = applier.state.coordinate_revision
        applier.take_changes()
        applier.apply(op)
        problems = validate(applier.state, applier.take_changes(), revision)
        if problems:
            return index, problems
    return None


class _Applier:
    def __init__(self, state, text, user_id, at):
        self.state, self.text, self.user_id, self.at = state, text, user_id, at
        self.index = entities.index(state.record)
        self.changes = validation.RecordChanges()
        self.handlers = {
            "verdict": self.apply_verdict,
            "coordinate": self.apply_coordinate,
            "note": self.apply_note,
            "set_value": self.apply_set_value,
            "set_evidence": self.apply_set_evidence,
            "link": self.apply_link,
            "unlink": self.apply_unlink,
            "create_entity": self.apply_create_entity,
            "delete_entity": self.apply_delete_entity,
        }

    def apply(self, op):
        return self.handlers[op["type"]](op)

    def take_changes(self):
        """``(changes, index)``: the record changes made since the last take, and the entity
        index of the record they are made to."""
        changes, self.changes = self.changes, validation.RecordChanges()
        return changes, self.index

    def apply_verdict(self, op):
        target = op["target"]
        self._check(target)
        key = target_key(target)
        before = copy.deepcopy(self.state.provenance.get(key))
        verdict = op["verdict"]
        reasons = {}
        if verdict == "clear":
            self.state.provenance.pop(key, None)
        elif verdict == "restore":
            self.state.provenance[key] = copy.deepcopy(op["previous"])
        elif verdict == "reject":
            self._mark(key, "removed")
        else:
            self._accept(key)
            if op.get("note") and target["kind"] == "coordinate_analysis" and (
                self.state.provenance[key]["state"] in ("edited", "added")
            ):
                reasons = self._annotate(op)
        after = copy.deepcopy(self.state.provenance.get(key))
        if target["kind"] == "coordinate_analysis":
            return {"provenance": before, "reasons": reasons}, after
        return before, after

    def _annotate(self, op):
        """Gives accept verdict ``op``'s note as the reason of its analysis's originals; returns
        the reasons those originals had, by key, where the note changed them."""
        parse, revision = self.state.coordinate_parse, self.state.coordinate_revision
        held = coordinates.reasons(parse, revision)
        self.state.coordinate_revision = coordinates.annotate(parse, revision, op)
        now = coordinates.reasons(parse, self.state.coordinate_revision)
        return {k: held.get(k) for k in held.keys() | now.keys() if held.get(k) != now.get(k)}

    def apply_coordinate(self, op):
        revision, before, after, marks, replacements = coordinates.revise(
            self.state.coordinate_parse, self.state.coordinate_revision, op
        )
        self.state.coordinate_revision = revision
        for key, state in marks:
            provenance_key = target_key({"kind": "coordinate_analysis", "analysis_key": key})
            if state == "verified":
                self._accept(provenance_key)
            else:
                self._mark(provenance_key, state)
        if op["action"] != "restore" and not replacements:
            before["entities"], after["entities"] = [], []
            return before, after
        record_before = copy.deepcopy(self._analysis_items())
        if op["action"] == "restore":
            record_follow.restore(self.state.record, op["payload"]["record"])
        else:
            after.update(record_follow.follow(self.state.record, replacements, self._minter(op)))
        self.index = entities.index(self.state.record)
        record_after = self._analysis_items()
        before["entities"] = lists.indexed(record_before, record_after, "entity")
        after["entities"] = lists.indexed(record_after, record_before, "entity")
        self.changes.membership(entities.STUDY, "analyses")
        for entry in after["entities"]:
            self.changes.part(entry["entity"]["local_id"])
        for key, state in record_follow.marks(record_before, record_after):
            self._mark(key, state)
        return before, after

    def _analysis_items(self):
        return self.state.record.get("analyses") or []

    def _minter(self, op):
        """``mint(*parts)`` gives a local_id seeded by the op's client_op_id and ``parts``."""
        def mint(*parts):
            return self._mint(":".join((op["client_op_id"], *map(str, parts))))
        return mint

    def apply_note(self, op):
        self._check(op["target"])
        return None, None

    def apply_set_value(self, op):
        target = op["target"]
        self._note_slot_change(target)
        item = self._entity(target["entity"]).item
        before = _wrapper_at(item, target, allow_absent=True)
        wrapper = {k: v for k, v in (before or {}).items() if k not in VALUE_FIELDS}
        wrapper.update(op["value"])
        if wrapper["extraction_status"] == "not_reported":
            wrapper.pop("value", None)
            wrapper["evidence"] = dict(NO_EVIDENCE)
        elif (wrapper.get("evidence") or {}).get("status", "not_applicable") == "not_applicable":
            wrapper["evidence"] = {"status": "not_found"}
        paths.set_path(item, target["path"], wrapper)
        self._mark(target_key(target), "edited")
        return copy.deepcopy(before), copy.deepcopy(wrapper)

    def apply_set_evidence(self, op):
        target, evidence = op["target"], self._filled(op["evidence"])
        key = target_key(target)
        if target["kind"] == "slot":
            self._note_slot_change(target)
            item = self._entity(target["entity"]).item
            wrapper = _wrapper_at(item, target, allow_absent=False)
            if evidence["status"] == "present" and wrapper.get("extraction_status") != "extracted":
                raise ReviewError(
                    f"{target['path']}: evidence needs an extracted value; set a value first"
                )
            before = copy.deepcopy(wrapper.get("evidence"))
            wrapper["evidence"] = evidence
        else:
            self._check(target)
            before = self.state.annotations.pop(key, None)
            if evidence != NO_EVIDENCE:
                self.state.annotations[key] = evidence
        self._mark(key, "edited")
        return before, copy.deepcopy(evidence)

    def apply_link(self, op):
        target = op["target"]
        row, owner, ids = self._relationship(target)
        self._note_slot_change(target)
        linked = self.index[target["target_entity"]]
        if row["target"] not in (linked.entity_class, linked.schema_class):
            raise ReviewError(
                f"{linked.local_id!r} is a {linked.schema_class}; {row['slot']} on "
                f"{row['class']} references {row['target']}"
            )
        if linked.local_id in ids:
            raise ReviewError(
                f"{target['entity']!r} {target['path']} already references {linked.local_id!r}"
            )
        before = copy.deepcopy(owner.get(row["slot"]))
        index = op.get("index")
        if not row["multivalued"]:
            if index is not None:
                raise ReviewError(f"{row['slot']!r} is not a list; index needs a list slot")
            owner[row["slot"]] = linked.local_id
            if before is not None:
                self._mark(target_key({**target, "target_entity": before}), "removed")
        else:
            position = len(ids) if index is None else index
            if position > len(ids):
                raise ReviewError(f"index {position} is past the end of {row['slot']!r}")
            owner[row["slot"]] = [*ids[:position], linked.local_id, *ids[position:]]
        return self._relinked(target, before, owner[row["slot"]], "added")

    def apply_unlink(self, op):
        target = op["target"]
        row, owner, ids = self._relationship(target, must_exist=True)
        self._note_slot_change(target)
        before = copy.deepcopy(owner.get(row["slot"]))
        remaining = [i for i in ids if i != target["target_entity"]]
        if remaining:
            owner[row["slot"]] = remaining
        else:
            owner.pop(row["slot"])
        return self._relinked(target, before, owner.get(row["slot"]), "removed")

    def apply_create_entity(self, op):
        parent = self._entity(op["parent"])
        lists = dict(CHILD_LISTS.get(parent.entity_class, ()))
        if op["list"] not in lists:
            raise ReviewError(f"{op['list']!r} is not an entity list of {parent.entity_class}")
        item = copy.deepcopy(op["entity"])
        if not item.get("local_id"):
            item = {"local_id": self._mint(op["client_op_id"]), **item}
        elif item["local_id"] in self.index:
            raise ReviewError(f"local_id {item['local_id']!r} already exists")
        siblings = paths.get(parent.item, op["list"]) or []
        index = op.get("index", len(siblings))
        if index > len(siblings):
            raise ReviewError(f"index {index} is past the end of {op['list']!r}")
        paths.set_path(parent.item, op["list"], [*siblings[:index], item, *siblings[index:]])
        self.changes.membership(parent.local_id, op["list"])
        self.changes.part(item["local_id"])
        self.index = entities.index(self.state.record)
        self._mark(f"entity:{item['local_id']}", "added")
        return None, {"parent": parent.local_id, "list": op["list"], "entity": copy.deepcopy(item)}

    def apply_delete_entity(self, op):
        local_id = op["target"]["entity"]
        if local_id == entities.STUDY:
            raise ReviewError("the study cannot be deleted")
        doomed = self._entity(local_id)
        siblings = paths.get(self.index[doomed.parent].item, doomed.list_path)
        position = next(i for i, item in enumerate(siblings) if item is doomed.item)
        removed = {local_id, *self._descendants(local_id)}
        del siblings[position]
        self.changes.membership(doomed.parent, doomed.list_path)
        self.index = entities.index(self.state.record)
        dangling = [
            ref for ref in references.references_in(self.index) if ref["target_entity"] in removed
        ]
        self._mark(f"entity:{local_id}", "removed")
        before = {
            "parent": doomed.parent,
            "list": doomed.list_path,
            "index": position,
            "entity": copy.deepcopy(doomed.item),
        }
        return before, {"references": dangling}

    def _entity(self, local_id):
        if local_id not in self.index:
            raise ReviewError(f"no entity has local_id {local_id!r}")
        return self.index[local_id]

    def _note_slot_change(self, target):
        """Note the part of a slot or relationship ``target``'s entity at the target's path as
        changed."""
        entity = self._entity(target["entity"])
        self.changes.part(entity.local_id, paths.location(entity.item, target["path"]))

    def _mark(self, key, state):
        self.state.provenance[key] = {"state": state, "user_id": self.user_id, "at": self.at}

    def _accept(self, key):
        if self.state.provenance.get(key, {}).get("state") not in ("edited", "added"):
            self._mark(key, "verified")

    def _check(self, target):
        """Raise unless ``target`` is in the documents."""
        kind = target["kind"]
        if kind == "slot":
            paths.get(self._entity(target["entity"]).item, target["path"])
        elif kind == "entity":
            self._entity(target["entity"])
        elif kind == "relationship":
            self._relationship(target, must_exist=True)
        elif kind == "coordinate_analysis":
            coordinates.known(
                self.state.coordinate_parse, self.state.coordinate_revision, target["analysis_key"]
            )

    def _filled(self, evidence):
        """``evidence`` with each span's text taken from the paper."""
        sets = evidence.get("sets") or []
        if evidence["status"] == "present" and not sets:
            raise ReviewError("present evidence needs at least one set")
        filled = []
        for evidence_set in sets:
            spans = []
            for span in evidence_set["spans"]:
                start, end = span["start_char"], span["end_char"]
                if start >= end:
                    raise ReviewError(f"span start_char {start} is not before end_char {end}")
                if end > len(self.text):
                    raise ReviewError(
                        f"span {start}-{end} is outside the paper's {len(self.text)} characters"
                    )
                spans.append({"start_char": start, "end_char": end, "text": self.text[start:end]})
            filled.append({**_without(evidence_set, "spans"), "spans": spans})
        return {**_without(evidence, "sets"), **({"sets": filled} if filled else {})}

    def _relationship(self, target, must_exist=False):
        """``(row, owner, linked ids)`` of a relationship target's reference slot."""
        row, owner = references.resolve_slot(self._entity(target["entity"]), target["path"])
        self._entity(target["target_entity"])
        ids = references.linked(row, owner)
        if must_exist and target["target_entity"] not in ids:
            raise ReviewError(
                f"{target['entity']!r} {target['path']} does not reference "
                f"{target['target_entity']!r}"
            )
        return row, owner, ids

    def _relinked(self, target, before, after, state):
        self._mark(target_key({**target, "kind": "slot"}), "edited")
        self._mark(target_key(target), state)
        return before, copy.deepcopy(after)

    def _mint(self, client_op_id):
        digest = hashlib.sha256(client_op_id.encode("utf-8")).hexdigest()
        local_id, n = f"rv_{digest[:12]}", 1
        while local_id in self.index:
            n += 1
            local_id = f"rv_{digest[:12]}_{n}"
        return local_id

    def _descendants(self, local_id):
        children = [e.local_id for e in self.index.values() if e.parent == local_id]
        return [d for child in children for d in (child, *self._descendants(child))]


def _is_wrapper(value):
    return isinstance(value, dict) and "extraction_status" in value


def _wrapper_at(item, target, allow_absent):
    """The ExtractedValue at a slot target's path in ``item``; None when absent and allowed."""
    value = paths.get(item, target["path"])
    if value is None and allow_absent:
        return None
    if not _is_wrapper(value):
        raise ReviewError(f"{target['path']!r} on {target['entity']!r} is not an extracted value")
    return value


def inverse(stored, client_op_id):
    """The ops that undo ``stored``; ``client_op_id`` names them (suffixed when several)."""
    ops = inverse_ops(stored)
    if len(ops) == 1:
        return [{"client_op_id": client_op_id, **ops[0]}]
    return [{"client_op_id": f"{client_op_id}-{n}", **o} for n, o in enumerate(ops, 1)]


def inverse_ops(stored):
    """The ops that undo ``stored``, without client_op_ids.

    Raises:
        ReviewError for an op type no op undoes: a note.
    """
    op, before, after = stored["op"], stored["before"], stored["after"]
    kind, target = op["type"], op.get("target")
    if kind == "set_value":
        before = before or {}
        value = {"extraction_status": before.get("extraction_status", "not_reported")}
        if "value" in before:
            value["value"] = before["value"]
        if before.get("value_source") is not None:
            value["value_source"] = before["value_source"]
        if before.get("unreported_reason") is not None:
            value["unreported_reason"] = before["unreported_reason"]
        ops = [{"type": "set_value", "target": target, "value": value}]
        if before and before.get("evidence") != after.get("evidence"):
            ops.append({"type": "set_evidence", "target": target,
                        "evidence": _op_evidence(before["evidence"])})
    elif kind == "set_evidence":
        ops = [{"type": "set_evidence", "target": target, "evidence": _op_evidence(before)}]
    elif kind == "link":
        # A list: unlink; a scalar: relink the replaced target.
        previous = None if isinstance(before, list) else before
        if previous is None:
            ops = [{"type": "unlink", "target": target}]
        else:
            ops = [{"type": "link", "target": {**target, "target_entity": previous}}]
    elif kind == "unlink":
        relink = {"type": "link", "target": target}
        if isinstance(before, list):
            relink["index"] = before.index(target["target_entity"])
        ops = [relink]
    elif kind == "create_entity":
        ops = [{"type": "delete_entity",
                "target": {"kind": "entity", "entity": after["entity"]["local_id"]}}]
    elif kind == "delete_entity":
        ops = [{"type": "create_entity", "parent": before["parent"], "list": before["list"],
                "index": before["index"], "entity": before["entity"]}]
    elif kind == "verdict" and target["kind"] == "coordinate_analysis":
        ops = [_judgement_back(target, before["provenance"])]
        if before["reasons"]:
            ops.append(_reasons_back(before["reasons"]))
    elif kind == "verdict":
        ops = [_judgement_back(target, before)]
    elif kind == "coordinate":
        restore = coordinates.restore_op(before, after)
        restore["payload"]["record"] = {"remove": after["entities"], "insert": before["entities"]}
        ops = [restore]
    else:
        raise ReviewError(f"a {kind} op has no inverse")
    return ops


def _judgement_back(target, before):
    """The verdict that restores provenance entry ``before``, or clears it if there was none."""
    if before is None:
        return {"type": "verdict", "target": target, "verdict": "clear"}
    return {"type": "verdict", "target": target, "verdict": "restore", "previous": before}


def _reasons_back(reasons):
    """The coordinate op that puts back the reasons ``reasons`` holds, by key; None clears one."""
    return {"type": "coordinate", "target": {"kind": "coordinate_parse"}, "action": "restore",
            "payload": {"remove": [], "insert": [], "reasons": reasons,
                        "record": {"remove": [], "insert": []}}}


def _op_evidence(evidence):
    """``evidence`` as a set_evidence op writes it: spans by offset only."""
    if evidence is None:
        return dict(NO_EVIDENCE)
    sets = [
        {**_without(e, "spans"),
         "spans": [{"start_char": s["start_char"], "end_char": s["end_char"]} for s in e["spans"]]}
        for e in evidence.get("sets") or ()
    ]
    return {**_without(evidence, "sets"), **({"sets": sets} if sets else {})}


def _without(mapping, *keys):
    return {k: v for k, v in mapping.items() if k not in keys}
