"""The review-bundle document: what the app loads for one paper, and the hidden set."""

import json
from collections import defaultdict
from functools import cache
from urllib.parse import urljoin

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from neurostore.review.core import SCHEMA_DIR, coordinates, entities, references
from neurostore.review.core.ops import OPS_SCHEMA


@cache
def validator():
    ops_schema = json.loads(OPS_SCHEMA.read_text("utf-8"))
    bundle_path = SCHEMA_DIR / "review-bundle.schema.json"
    bundle_schema = json.loads(bundle_path.read_text("utf-8"))
    ops_uri = urljoin(bundle_schema["$id"], OPS_SCHEMA.name)
    registry = Registry().with_resource(ops_uri, Resource.from_contents(ops_schema))
    return Draft202012Validator(bundle_schema, registry=registry)


def bundle(*, source, text, parsed_paper, original, state, review, ops, reviewers):
    """The review-bundle document; ``original`` is the record as loaded, ``review`` is
    {id, user_id, state} or None."""
    index = entities.index(state.record)
    return {
        "source": source,
        "text": text,
        "parsed_paper": parsed_paper,
        "coordinate_parse": state.coordinate_parse,
        "record": state.record,
        "coordinate_revision": state.coordinate_revision,
        "review": review and {
            **review,
            "last_seq": state.last_seq,
            "provenance": state.provenance,
            "annotations": state.annotations,
        },
        "ops": ops,
        "entities": entities.index_rows(state.record),
        "hidden": hidden(state.record, state.coordinate_parse, state.coordinate_revision,
                         state.provenance, index),
        "original": {
            "record": original,
            "entities": entities.index_rows(original),
            "hidden": hidden(original, state.coordinate_parse, None, {}),
        },
        "reviewers": reviewers,
    }


def source_summary(source):
    """The bundle's source block, from a review source row and the full text row it reads."""
    return {
        "id": source.id,
        "base_study_id": source.fulltext.base_study_id,
        "label": source.label or "",
        "origin": source.origin,
        "text_sha256": source.fulltext.sha256,
        "schema_versions": source.schema_versions or {},
    }


def hidden(record, parse, revision, provenance, index=None):
    """The local ids hidden by default: non-coordinate analyses and what only they reach.

    An analysis is non-coordinate when its source_table_analysis is missing, not reported, a
    key ``coordinate_parse`` (the reviewer's revision, once there is one) lacks, or a key the
    reviewer rejected in ``provenance``. An entity is hidden when those analyses reach it (by
    reference or as a descendant) and no shown entity does; a shown entity's ancestors are
    shown.
    """
    index = entities.index(record) if index is None else index
    keys = {a.get("key") for a in (coordinates.current(parse, revision) or {}).get("analyses", [])}
    keys -= {None} | coordinates.rejected(provenance, keys)
    analyses = {
        e.local_id
        for e in index.values()
        if e.entity_class == "Analysis" and entities.table_key(e.item) not in keys
    }
    targets = defaultdict(set)
    for reference in references.references_in(index):
        targets[reference["entity"]].add(reference["target_entity"])
    children = defaultdict(list)
    for entity in index.values():
        if entity.parent is not None and entity.parent != entities.STUDY:
            children[entity.parent].append(entity.local_id)

    behind = _reached_from_hidden(index, analyses, targets, children) - analyses
    roots = [
        i
        for i, e in index.items()
        if i not in analyses and (i not in behind or e.entity_class == "Analysis")
    ]
    shown = _shown_from_roots(index, roots, analyses, targets, children)
    return {
        "analyses": [i for i in index if i in analyses],
        "entities": [i for i in index if i in behind - shown],
    }


def _reached_from_hidden(index, analyses, targets, children):
    seen, stack = set(), list(analyses)
    while stack:
        local_id = stack.pop()
        if local_id in seen or local_id not in index:
            continue
        seen.add(local_id)
        stack.extend(targets[local_id])
        stack.extend(children[local_id])
    return seen


def _shown_from_roots(index, roots, analyses, targets, children):
    seen, stack = set(), list(roots)
    while stack:
        local_id = stack.pop()
        if local_id in seen or local_id in analyses or local_id not in index:
            continue
        seen.add(local_id)
        stack.extend(targets[local_id])
        stack.extend(children[local_id])
        if index[local_id].parent is not None:
            stack.append(index[local_id].parent)
    return seen
