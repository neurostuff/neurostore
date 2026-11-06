"""Three real extraction records, with normalized sidecars, uploaded through the ingester.

`data/astra_records_normalized.json` holds three Astra records from ns-pond's
normalization tests (ingestion_workflow/tests/normalization/data/astra_records.json):

    ya2RC6UYbibC  schizophrenia, bipolar disorder with psychotic features and controls,
                  2-back > 0-back, ROI analyses
    6SKTGteXbbBs  nicotine-dependent smokers and non-smokers, monetary incentive delay,
                  whole brain
    AhxosLhYA5YG  adolescents with conduct disorder, spatial working memory vs vigilance,
                  whole brain; its two record analyses share one key

Their sidecars carry that file's build rows (canonical task, task family, contrast key,
one contrast set) and hand-mapped MONDO terms for `medical_condition`. The records'
keys name parses neurostore does not hold, so `upload` builds a parse for each and gives
the record that parse's keys.
"""

import copy
import json
from pathlib import Path

from neurostore.ingest.concepts import (
    Release,
    file_sha256,
    read_obographs,
    sync_vocabulary_releases,
)
from neurostore.ingest.study_schema import ingest_upload
from neurostore.tests import study_schema_fixtures as fx

RECORDS = json.loads(
    (Path(__file__).parent / "data" / "astra_records_normalized.json").read_text()
)["records"]
PMIDS = {"ya2RC6UYbibC": "20000001", "6SKTGteXbbBs": "20000002", "AhxosLhYA5YG": "20000003"}


def record(name):
    return copy.deepcopy(RECORDS[name])


def keys_of(document):
    return list(
        dict.fromkeys(
            analysis["source_table_analysis"]["value"] for analysis in document["analyses"]
        )
    )


OBO = "http://purl.obolibrary.org/obo/"
#: Schizophrenia under psychotic disorder under psychiatric disorder; bipolar disorder
#: with psychotic features left out.
MONDO = {
    "MONDO:0002025": ("psychiatric disorder", [], []),
    "MONDO:0005487": ("psychotic disorder", ["MONDO:0002025"], []),
    "MONDO:0005090": ("schizophrenia", ["MONDO:0005487"], ["dementia praecox"]),
}


def _iri(curie):
    return OBO + curie.replace(":", "_")


def mondo_release(tmp_path, terms=MONDO, version="test"):
    """A test MONDO release in OBO Graphs JSON, with one deprecated class, and its pin."""
    nodes = [
        {
            "id": _iri(c),
            "type": "CLASS",
            "lbl": label,
            "meta": {"synonyms": [{"pred": "hasExactSynonym", "val": s} for s in synonyms]},
        }
        for c, (label, _, synonyms) in terms.items()
    ]
    nodes.append(
        {"id": _iri("MONDO:0000001"), "type": "CLASS", "lbl": "old", "meta": {"deprecated": True}}
    )
    edges = [
        {"sub": _iri(c), "pred": "is_a", "obj": _iri(p)}
        for c, (_, parents, _) in terms.items()
        for p in parents
    ]
    edges.append({"sub": _iri("MONDO:0005090"), "pred": "is_a", "obj": _iri("MONDO:0000001")})
    path = tmp_path / f"mondo-{version}.json"
    path.write_text(json.dumps({"graphs": [{"nodes": nodes, "edges": edges}]}))
    release = Release("mondo", version, None, file_sha256(path), read_obographs, "MONDO")
    return release, path


def load(tmp_path, **kwargs):
    """Load a test MONDO release (see `mondo_release`)."""
    release, path = mondo_release(tmp_path, **kwargs)
    return sync_vocabulary_releases({"mondo": path}, releases={"mondo": release})


def with_roles(document, roles):
    """``document`` with an `astra medical role` entry on the item of each mapped term
    ``roles`` names (``{term: role}``), as ns-pond writes them."""
    for group in document["groups"]:
        slot = group["medical_condition"]
        for entry in list(slot.get("normalized") or []):
            if entry.get("value") in roles:
                slot["normalized"].append(
                    {
                        "vocabulary": "astra medical role",
                        "status": "mapped",
                        "value": roles[entry["value"]],
                        "item": entry["item"],
                        "mapping_tool": "fixture",
                    }
                )
    return document


def unmap_names(document, analysis_name=None):
    """``document`` with the normalizer entries on its analyses' names (only
    ``analysis_name``'s, when given) turned unmapped."""
    for analysis in document["analyses"]:
        if analysis_name in (None, analysis["name"]["value"]):
            for entry in analysis["name"]["normalized"]:
                entry.update(status="unmapped", value=None)
    return document


def normalized_slots(document):
    """The slots of ``document`` normalizers write entries on."""
    return [
        slot
        for slot in (
            *(group.get("medical_condition") for group in document["groups"]),
            *(task.get("name") for task in document["tasks"]),
            *(analysis.get("name") for analysis in document["analyses"]),
        )
        if isinstance(slot, dict) and slot.get("normalized")
    ]


def upload_body(name, document=None):
    """The upload of record ``name`` (or ``document``) with a parse holding its analyses:
    one text analysis per key, the i-th named "<name> analysis <i>"."""
    document = document if document is not None else record(name)
    old_keys = keys_of(document)
    parsed = [
        fx.text_analysis([(i * 10, i * 10 + 5)], f"{name} analysis {i}", [fx.point((i, i, i))])
        for i, _ in enumerate(old_keys)
    ]
    text = json.dumps(document)
    for old, new in zip(old_keys, (a["key"] for a in parsed)):
        text = text.replace(old, new)
    return {"coordinate_parse": fx.parse(parsed, pmid=PMIDS[name]), "record": json.loads(text)}


def upload(name, document=None):
    """Upload record ``name`` (or ``document``) through the ingester; its summary."""
    return ingest_upload(upload_body(name, document))
