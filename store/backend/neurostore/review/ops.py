"""Apply review-ops batches to a ReviewState."""

import copy
import hashlib
import json
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import best_match

from neurostore.review import ReviewError, coordinates, entities, paths, references
from neurostore.study_schema_tools import CHILD_LISTS, schema_errors

OPS_SCHEMA = Path(__file__).parent / "schema" / "review-ops.schema.json"
#: The fields of an ExtractedValue a set_value op writes, as a group.
VALUE_FIELDS = ("extraction_status", "value", "value_source", "unreported_reason")
#: Evidence that clears an entity's or a relationship's annotation.
NO_EVIDENCE = {"status": "not_applicable"}


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


def apply_batch(state, batch, *, text, user_id, at):
    """``(new state, stored ops)`` for ``batch`` applied in order to a copy of ``state``.

    Raises:
        ReviewError naming each failing op; the input state is never changed.
    """
    _check_batch(batch)
    ops = batch["ops"]
    applied = _apply(state, ops, text, user_id, at)
    if _document_errors(applied[0]):
        index = _first_invalid_op(state, ops, text, user_id, at)
        problems = _document_errors(_apply(state, ops[: index + 1], text, user_id, at)[0])
        raise ReviewError(
            f"op {index} leaves an invalid document",
            [f"op {index}: {problem}" for problem in problems],
        )
    return applied


@cache
def _ops_schema():
    return json.loads(OPS_SCHEMA.read_text("utf-8"))


@cache
def _batch_validator():
    schema = _ops_schema()
    ops = {**schema["properties"]["ops"], "items": True}
    return Draft202012Validator({**schema, "properties": {**schema["properties"], "ops": ops}})


@cache
def _op_validator():
    return Draft202012Validator({"$defs": _ops_schema()["$defs"], "$ref": "#/$defs/Op"})


def _check_batch(batch):
    errors = [f"batch: {error.message}" for error in _batch_validator().iter_errors(batch)]
    for index, item in enumerate(batch.get("ops") or ()):
        error = best_match(_op_validator().iter_errors(item))
        if error is not None:
            errors.append(f"op {index}: {error.message}")
    if errors:
        raise ReviewError("the batch does not validate against review-ops", errors)


def _document_errors(state):
    problems = []
    documents = [("extraction-record", state.record)]
    if state.coordinate_revision is not None:
        documents.append(("coordinate-parse", state.coordinate_revision))
    for name, document in documents:
        for error in schema_errors(name, document):
            error = best_match([error])
            where = "/".join(str(part) for part in error.absolute_path)
            problems.append(f"{name} /{where}: {error.message}")
    return problems


def _apply(state, ops, text, user_id, at):
    state = copy.deepcopy(state)
    applier = _Applier(state, text, user_id, at)
    stored = []
    for index, op in enumerate(ops):
        try:
            before, after = applier.apply(op)
        except ReviewError as error:
            raise ReviewError(
                f"op {index} cannot be applied", [f"op {index}: {p}" for p in error.problems]
            ) from error
        state.last_seq += 1
        stored.append({
            "seq": state.last_seq,
            "op": copy.deepcopy(op),
            "before": before,
            "after": after,
            "user_id": user_id,
            "created_at": at,
        })
    return state, stored


def _first_invalid_op(state, ops, text, user_id, at):
    """The index of the first op after which the document is invalid."""
    applier = _Applier(copy.deepcopy(state), text, user_id, at)
    for index, op in enumerate(ops):
        applier.apply(op)
        if _document_errors(applier.state):
            return index


class _Applier:
    def __init__(self, state, text, user_id, at):
        self.state, self.text, self.user_id, self.at = state, text, user_id, at
        self.index = entities.index(state.record)
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

    def apply_verdict(self, op):
        target = op["target"]
        self._check(target)
        key = target_key(target)
        before = copy.deepcopy(self.state.provenance.get(key))
        if op["verdict"] == "reject":
            self._mark(key, "removed")
        else:
            self._accept(key)
        return before, copy.deepcopy(self.state.provenance[key])

    def apply_coordinate(self, op):
        key = op["target"]["analysis_key"]
        revision, before, after = coordinates.revise(
            self.state.coordinate_parse,
            self.state.coordinate_revision,
            key,
            op["action"],
            op.get("role"),
            op.get("note"),
        )
        self.state.coordinate_revision = revision
        provenance_key = target_key(op["target"])
        if op["action"] == "accept":
            self._accept(provenance_key)
        else:
            self._mark(provenance_key, "edited" if op["action"] == "relabel" else "removed")
        return before, after

    def apply_note(self, op):
        self._check(op["target"])
        return None, None

    def apply_set_value(self, op):
        target = op["target"]
        item = self._entity(target["entity"]).item
        before = _wrapper_at(item, target, allow_absent=True)
        wrapper = {k: v for k, v in (before or {}).items() if k not in VALUE_FIELDS}
        wrapper.update(op["value"])
        if wrapper["extraction_status"] == "not_reported":
            wrapper.pop("value", None)
            wrapper["evidence"] = dict(NO_EVIDENCE)
        elif wrapper.get("evidence", {}).get("status", "not_applicable") == "not_applicable":
            wrapper["evidence"] = {"status": "not_found"}
        paths.set_path(item, target["path"], wrapper)
        self._mark(target_key(target), "edited")
        return copy.deepcopy(before), copy.deepcopy(wrapper)

    def apply_set_evidence(self, op):
        target, evidence = op["target"], self._filled(op["evidence"])
        key = target_key(target)
        if target["kind"] == "slot":
            item = self._entity(target["entity"]).item
            wrapper = _wrapper_at(item, target, allow_absent=False)
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
        else:
            position = len(ids) if index is None else index
            if position > len(ids):
                raise ReviewError(f"index {position} is past the end of {row['slot']!r}")
            owner[row["slot"]] = [*ids[:position], linked.local_id, *ids[position:]]
        return self._relinked(target, before, owner[row["slot"]], "added")

    def apply_unlink(self, op):
        target = op["target"]
        row, owner, ids = self._relationship(target, must_exist=True)
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
            coordinates.original_analysis(self.state.coordinate_parse, target["analysis_key"])

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
            filled.append({"spans": spans})
        return {"status": evidence["status"], **({"sets": filled} if filled else {})}

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


def target_key(target):
    """A target as one string (review-bundle.schema.json#/$defs/TargetKey)."""
    kind = target["kind"]
    if kind == "slot":
        return f"slot:{target['entity']}:{target['path']}"
    if kind == "entity":
        return f"entity:{target['entity']}"
    if kind == "relationship":
        return f"relationship:{target['entity']}:{target['path']}:{target['target_entity']}"
    if kind == "coordinate_analysis":
        return f"coordinate_analysis:{target['analysis_key']}"
    return "paper"


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
    else:
        raise ReviewError(f"a {kind} op has no inverse")
    if len(ops) == 1:
        return [{"client_op_id": client_op_id, **ops[0]}]
    return [{"client_op_id": f"{client_op_id}-{n}", **o} for n, o in enumerate(ops, 1)]


def _op_evidence(evidence):
    """``evidence`` as a set_evidence op writes it: spans by offset only."""
    if evidence is None:
        return dict(NO_EVIDENCE)
    sets = [
        {"spans": [{"start_char": s["start_char"], "end_char": s["end_char"]} for s in e["spans"]]}
        for e in evidence.get("sets") or ()
    ]
    return {"status": evidence["status"], **({"sets": sets} if sets else {})}
