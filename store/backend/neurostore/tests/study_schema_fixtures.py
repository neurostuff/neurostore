"""Builders for study_schema uploads: coordinate parses, revisions and records.

Records are filled from the extraction-record JSON Schema with the least each required
field allows (``not_reported``), then given the fields a test is about.
"""

import hashlib
import json

from study_schema import keys
from study_schema.jsonschema import load
from study_schema.models.paper_parse import ParsedAnalysis

from neurostore import study_schema_tools

SCHEMA_VERSION = load("coordinate-parse")["version"]


def cells(*rows, column_group=0):
    return [{"row": row, "column_group": column_group} for row in rows]


def point(xyz, sign="positive", t=3.5, space=None):
    """A point whose values give ``sign``; an unsigned one has a p value only."""
    if sign == "unsigned":
        values = [{"kind": "p", "value": 0.001}]
    else:
        values = [{"kind": "t", "value": t if sign != "negative" else -t}]
    return {"coordinates": list(xyz), "space": space, "values": values}


def _keyed(analysis):
    """``analysis`` with the content key its name, space and points give."""
    analysis["key"] = keys.key_for(ParsedAnalysis.model_validate({**analysis, "key": ""}))
    return analysis


def spelled_key(canonical):
    """The key coordinates.yaml spells out for ``canonical`` ([normalized name, space,
    [[x, y, z, own space, [[kind, value], ...]], ...]], written as the rule writes it),
    hashed here rather than by `keys.key_for`."""
    payload = json.dumps(canonical, separators=(",", ":"), ensure_ascii=False)
    return "analysis#" + hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def table_analysis(table_id, rows, name, points, role="result", space="MNI", **extra):
    return _keyed({
        "origin": "table",
        "table_id": table_id,
        "cells": cells(*rows),
        "name": name,
        "coordinate_space": space,
        "role": role,
        "points": points,
        **extra,
    })


def text_analysis(spans, name, points=(), role="result", space="MNI"):
    return _keyed({
        "origin": "text",
        "text_spans": [{"start_char": s, "end_char": e} for s, e in spans],
        "name": name,
        "coordinate_space": space,
        "role": role,
        "points": list(points),
    })


def parse(analyses, pmid="12345678", revision_of=None, verdicts=None, producer="ingestion"):
    document = {
        "header": {
            "artifact_kind": "coordinate_parse",
            "schema_version": SCHEMA_VERSION,
            "article_id": f"art-{pmid}",
            "identifiers": {"pmid": pmid},
            "producer": {"name": producer, "version": "1.0.0", "stage": "analyses"},
        },
        "parse_id": hashlib.sha256(
            json.dumps(analyses, sort_keys=True).encode("utf-8")
        ).hexdigest(),
        "text_sha256": "0" * 64,
        "analyses": analyses,
    }
    if revision_of is not None:
        document["revision_of"] = revision_of
        document["verdicts"] = verdicts or []
        document["header"]["producer"] = {"name": "pondie", "version": "1.0.0"}
    return document


def verdict(key, kind, replaced_by=None, reason="audited"):
    return {"key": key, "verdict": kind, "replaced_by": replaced_by, "reason": reason}


defs = load("extraction-record")["$defs"]


def minimal(schema, defs=defs):
    return study_schema_tools.minimal(defs, schema, string="x")


def extracted(value):
    return {
        "value": value,
        "extraction_status": "extracted",
        "evidence": {"status": "not_found"},
    }


def record_analysis(local_id, key, name):
    analysis = minimal(defs["Analysis"])
    analysis.update(
        local_id=local_id,
        name=extracted(name),
        definition=extracted(f"{name}, as defined"),
        source_table_analysis=extracted(key),
    )
    return analysis


def record(analyses, coordinate_sets=(), local_id="study-1"):
    document = minimal(load("extraction-record"))
    document.update(
        local_id=local_id,
        extraction_metadata={"extractor_model": "gpt-6.1-sol", "extractor_version": "1.0.0"},
        analyses=list(analyses),
    )
    if coordinate_sets:
        document["coordinate_sets"] = [
            {"local_id": key, "role": extracted("result")} for key in coordinate_sets
        ]
    return document


def parsed_paper(pmid="12345678", corrections=None):
    """A minimal parsed paper; ``corrections`` are its bibliography's notices."""
    schema = load("parsed-paper")
    document = minimal(schema, schema["$defs"])
    document["header"]["identifiers"] = {"pmid": pmid}
    document["bibliography"] = {"title": "A paper"}
    if corrections is not None:
        document["bibliography"]["corrections"] = corrections
    return document
