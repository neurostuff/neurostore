"""Resolve SciCrunch SCR RRIDs -> TSV of name, synonyms, resource types, description.

usage: python -I pull_rrid.py COUNTS.txt OUT.tsv   (COUNTS lines: "<count> <6-digit id>")
"""

import csv
import json
import re
import sys
import time
import urllib.request


def resolve(scr):
    url = f"https://scicrunch.org/resolver/SCR_{scr}.json"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(
                urllib.request.Request(
                    url, headers={"User-Agent": "ns-pond-consortia"}
                ),
                timeout=60,
            ) as r:
                hits = json.load(r)["hits"]["hits"]
                return hits[0]["_source"] if hits else None
        except (OSError, ValueError):
            time.sleep(2**attempt)
    return None


with open(sys.argv[2], "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(
        [
            "rrid",
            "corpus_mentions",
            "name",
            "synonyms",
            "types",
            "keywords",
            "description",
        ]
    )
    with open(sys.argv[1]) as f:
        lines = f.read().splitlines()
    for line in lines:
        n, scr = line.split()
        src = resolve(scr)
        time.sleep(0.2)
        if not src:
            continue
        item = src.get("item", {})
        types = sorted(
            {
                t.get("name", "")
                for t in item.get("types", []) + src.get("resource_types", [])
                if isinstance(t, dict)
            }
            | {c.get("name", "") for c in item.get("contentTypes", [])}
        )
        kws = [
            k.get("keyword", "")
            for k in item.get("keywords", [])
            if isinstance(k, dict)
        ]
        w.writerow(
            [
                f"SCR_{scr}",
                n,
                item.get("name", ""),
                "|".join(s.get("name", "") for s in item.get("synonyms", [])),
                "|".join(t for t in types if t),
                "|".join(kws),
                re.sub(r"\s+", " ", item.get("description", ""))[:400],
            ]
        )
