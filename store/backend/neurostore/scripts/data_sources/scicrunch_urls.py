"""Homepages (and RRIDs) from SciCrunch for dictionary entries, matched on an exact name, synonym or abbreviation.

usage: SCICRUNCH_API_KEY=... python -I scicrunch_urls.py API_URL IDS.txt OUT.tsv
"""

import csv
import json
import os
import sys
import subprocess
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match import key, read_dictionary_rows, read_lines, split  # noqa: E402

URL = "https://scicrunch.org/api/1/elastic/RIN_Tool_pr/_search"


def search(text):
    body = {
        "size": 10,
        "_source": [
            "item.identifier",
            "item.name",
            "item.synonyms",
            "item.abbreviations",
            "distributions",
        ],
        "query": {
            "multi_match": {
                "query": text,
                "type": "phrase",
                "fields": [
                    "item.name",
                    "item.synonyms.name",
                    "item.abbreviations.name",
                ],
            }
        },
    }
    # curl, with the key read from stdin so it stays out of the process list (urllib is refused with 403)
    config = f'url = "{URL}?api_key={os.environ["SCICRUNCH_API_KEY"]}"\nheader = "Content-Type: application/json"\n'
    res = subprocess.run(
        [
            "curl",
            "-s",
            "--max-time",
            "60",
            "-K",
            "-",
            "--data-binary",
            json.dumps(body),
        ],
        input=config.encode(),
        capture_output=True,
        check=True,
    )
    return json.loads(res.stdout)["hits"]["hits"]


def main():
    dict_path, ids_path, out = sys.argv[1:4]
    rows = {r["id"]: r for r in read_dictionary_rows(dict_path)}
    ids = [ln.split("\t", 1)[0].strip() for ln in read_lines(ids_path) if ln.strip()]
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(["id", "rrid", "label", "url"])
        for id_ in ids:
            r = rows[id_]
            names = list(dict.fromkeys([r["name"], *split(r["full_names"])]))
            # acronyms alone are too ambiguous to search, but may confirm a hit found by name
            wanted = {key(n) for n in names if len(key(n)) >= 4}
            found = None
            for name in names[:3]:
                for h in search(name):
                    s, item = h["_source"], h["_source"]["item"]
                    labels = [item.get("name", "")] + [
                        x.get("name", "") for x in item.get("synonyms") or []
                    ]
                    dist = s.get("distributions", {})
                    url = next(
                        (
                            d["uri"]
                            for k in ("current", "alternate")
                            for d in dist.get(k, [])
                            if d.get("uri")
                        ),
                        "",
                    )
                    if url and wanted & {key(x) for x in labels if x}:
                        found = (item.get("identifier", ""), item.get("name", ""), url)
                        break
                time.sleep(0.3)
                if found:
                    break
            w.writerow([id_, *(found or ("", "", ""))])


if __name__ == "__main__":
    main()
