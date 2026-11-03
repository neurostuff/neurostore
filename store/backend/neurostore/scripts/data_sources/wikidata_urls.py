"""Official websites (P856) from Wikidata for dictionary entries, matched on an exact label or alias.

usage: python -I wikidata_urls.py API_URL IDS.txt OUT.tsv

IDS.txt lists the ids to look up (first tab-separated column). A candidate item counts only when one of its
labels or aliases equals one of the entry's names or acronyms after key() normalisation.
"""

import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match import key, read_dictionary_rows, read_lines, split  # noqa: E402

API = "https://www.wikidata.org/w/api.php"
HEADERS = {"User-Agent": "neurostore-consortia-dictionary/0.1"}


def call(**params):
    q = urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(f"{API}?{q}", headers=HEADERS)
    # rate limited (429): wait as asked and retry; the last attempt's error is raised
    for _ in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 30))
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    dict_path, ids_path, out = sys.argv[1:4]
    rows = {r["id"]: r for r in read_dictionary_rows(dict_path)}
    ids = [ln.split("\t", 1)[0].strip() for ln in read_lines(ids_path) if ln.strip()]
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(["id", "qid", "label", "url"])
        for id_ in ids:
            r = rows[id_]
            names = [r["name"], *split(r["full_names"])]
            wanted = {
                key(n) for n in names + split(r["acronyms_safe"]) if len(key(n)) >= 4
            }
            found = None
            for name in dict.fromkeys(names[:3]):
                hits = call(
                    action="wbsearchentities", search=name, language="en", limit=7
                ).get("search", [])
                qids = [h["id"] for h in hits]
                if not qids:
                    continue
                ents = call(
                    action="wbgetentities",
                    ids="|".join(qids),
                    props="labels|aliases|claims",
                    languages="en",
                )["entities"]
                for qid in qids:
                    e = ents[qid]
                    labels = [v["value"] for v in e.get("labels", {}).values()]
                    labels += [
                        a["value"] for v in e.get("aliases", {}).values() for a in v
                    ]
                    sites = [
                        c["mainsnak"].get("datavalue", {}).get("value")
                        for c in e.get("claims", {}).get("P856", [])
                    ]
                    sites = [s for s in sites if s]
                    if sites and wanted & {key(x) for x in labels}:
                        found = (qid, labels[0] if labels else "", sites[0])
                        break
                time.sleep(2)
                if found:
                    break
            w.writerow([id_, *(found or ("", "", ""))])
            f.flush()


if __name__ == "__main__":
    main()
