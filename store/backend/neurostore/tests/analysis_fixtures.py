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
