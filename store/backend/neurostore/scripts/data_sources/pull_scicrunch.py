"""SciCrunch registry resources of data/organisation types that mention MRI or PET -> TSV.

usage: SCICRUNCH_API_KEY=... python -I pull_scicrunch.py OUT.tsv
"""

import csv
import json
import os
import re
import sys
import urllib.request

URL = (
    "https://scicrunch.org/api/1/elastic/RIN_Tool_pr/_search?api_key="
    + os.environ["SCICRUNCH_API_KEY"]
)
TYPES = [
    "database",
    "data set",
    "data repository",
    "image repository",
    "image collection",
    "project portal",
    "organization portal",
    "consortium",
    "biobank",
    "topical portal",
    "data or information resource",
]
IMAGING = (
    'MRI OR fMRI OR PET OR "magnetic resonance" OR neuroimaging OR "positron emission" OR '
    '"brain imaging" OR connectome OR DTI OR "diffusion tensor"'
)
PAGE = 500


def search(start):
    body = {
        "size": PAGE,
        "from": start,
        "sort": [{"item.identifier": "asc"}],
        "_source": [
            "item.identifier",
            "item.name",
            "item.synonyms",
            "item.types",
            "item.keywords",
            "item.description",
            "item.abbreviations",
        ],
        "query": {
            "bool": {
                "must": [
                    {
                        "query_string": {
                            "query": IMAGING,
                            "fields": [
                                "item.name",
                                "item.description",
                                "item.keywords.keyword",
                                "item.synonyms.name",
                            ],
                            "lenient": True,
                        }
                    },
                    {"terms": {"item.types.name.aggregate": TYPES}},
                ]
            }
        },
    }
    req = urllib.request.Request(
        URL,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)["hits"]


def names(xs, k="name"):
    return "|".join(x.get(k, "") for x in xs or [] if isinstance(x, dict) and x.get(k))


with open(sys.argv[1], "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(
        [
            "rrid",
            "name",
            "synonyms",
            "abbreviations",
            "types",
            "keywords",
            "description",
        ]
    )
    start, total = 0, None
    while total is None or start < total:
        hits = search(start)
        total = (
            hits["total"] if isinstance(hits["total"], int) else hits["total"]["value"]
        )
        for h in hits["hits"]:
            it = h["_source"]["item"]
            w.writerow(
                [
                    it.get("identifier", ""),
                    it.get("name", ""),
                    names(it.get("synonyms")),
                    names(it.get("abbreviations")),
                    names(it.get("types")),
                    names(it.get("keywords"), "keyword"),
                    re.sub(r"\s+", " ", it.get("description", ""))[:500],
                ]
            )
        start += PAGE
        print(f"{min(start, total)}/{total}", file=sys.stderr)
