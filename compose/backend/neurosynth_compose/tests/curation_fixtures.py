"""Provenance documents in the shapes production holds.

`real_provenance()` is a public project's document (tests/data). The irregular
variant adds every odd shape found across the 4,921 projects of the 2026-11-28
production backup, with how many stubs had it.
"""

import copy
import json
from pathlib import Path

_REAL = json.loads(
    (Path(__file__).parent / "data" / "project_provenance_curated.json").read_text()
)


def real_provenance():
    return copy.deepcopy(_REAL)


def irregular_provenance():
    doc = real_provenance()
    curation = doc["curationMetadata"]
    first, second = curation["columns"]
    stub = copy.deepcopy(second["stubStudies"][0])
    odd = []
    # 543 stubs are JSON null; 45 hold only `exclusionTag`.
    odd += [None, {"exclusionTag": None}]
    # 25 legacy stubs keep the whole exclusion tag object.
    odd.append({**stub, "id": "odd-exclusion", "exclusionTag": curation["exclusionTags"][0]})
    # 238 years are numbers; 7 abstracts and 169 article links are lists.
    odd.append({**stub, "id": "odd-types", "articleYear": 2017, "abstractText": ["a", "b"],
                "articleLink": ["https://example.org/1"]})
    # 2,779 stub tags are not among the project's tags.
    odd.append({**stub, "id": "odd-tag", "tags": [
        {"id": "a26ed48f-0000", "label": "this_sleuth.txt", "isAssignable": True,
         "isExclusionTag": False},
        stub["tags"][0],
    ]})
    # pmcid, importId and neurostoreId are optional; searchTerm is not in the frontend type.
    unlinked = {k: v for k, v in stub.items() if k not in ("pmcid", "neurostoreId", "searchTerm")}
    odd.append({**unlinked, "id": "odd-unlinked", "importId": "import-1"})
    # A stub naming a Neurostore id with its own title (6.9% differ from the commonest).
    odd.append({**stub, "id": "odd-own-title", "title": "A title edited in Compose"})
    first["stubStudies"].extend(odd)
    curation["imports"] = [
        {"id": "import-1", "date": "2025-01-01T00:00:00.000Z", "name": "PubMed import",
         "numImported": 3, "importModeUsed": "PUBMED_IMPORT"},
        # 51 imports carry these two keys; errorsDuringImport is a bool or a string.
        {"id": "import-2", "date": "2025-01-02T00:00:00.000Z", "name": "Neurostore import",
         "numImported": 2, "importModeUsed": "NEUROSTORE_IMPORT", "errorsDuringImport": True,
         "neurostoreSearchParams": "?genericSearchStr=x", "neurostoreSource": "neurostore"},
    ]
    # 2,025 projects list the duplicate tag both as an exclusion and under identification.
    curation["prismaConfig"]["identification"]["exclusionTags"] = [curation["exclusionTags"][1]]
    # 69 statuses are the legacy "COMPLETE"; 1,414 repeat a study id.
    doc["extractionMetadata"]["studyStatusList"] += [
        {"id": "22gYeMb5k4JH", "status": "COMPLETE"},
    ]
    # Keys from older frontends survive at the top level of 230 projects.
    doc["algorithmMetadata"] = {"specificationId": "abc"}
    doc["type"] = "CBMA"
    return doc
