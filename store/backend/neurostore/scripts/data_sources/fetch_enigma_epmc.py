"""ENIGMA neuroimaging papers from Europe PMC: metadata, full-text XML and supplementary files.

usage: python -I fetch_enigma_epmc.py OUT_DIR [--max-file-mb N] [--threads N]

Writes OUT_DIR/papers.tsv and OUT_DIR/files/PMCID/. Files come from the PMC Open Access S3 bucket, which has each
supplement as its own object; papers outside the OA subset get only the Europe PMC full-text XML.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = "https://www.ebi.ac.uk/europepmc/webservices/rest"
S3 = "https://pmc-oa-opendata.s3.amazonaws.com"
QUERY = (
    'ABSTRACT:"ENIGMA" AND (ABSTRACT:"MRI" OR ABSTRACT:"neuroimaging" OR ABSTRACT:"cortical" OR '
    'ABSTRACT:"subcortical" OR ABSTRACT:"white matter" OR ABSTRACT:"brain")'
)
FIELDS = [
    "pmid",
    "pmcid",
    "doi",
    "year",
    "title",
    "journal",
    "open_access",
    "in_epmc",
    "has_suppl",
    "authors",
]
KEEP = re.compile(r"\.(?:xml|docx?|xlsx?|pdf|csv|txt)$", re.I)


def get(url, timeout=120):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return r.read()


def search():
    rows, cursor = [], "*"
    while True:
        q = urllib.parse.urlencode(
            {
                "query": QUERY,
                "format": "json",
                "pageSize": 1000,
                "cursorMark": cursor,
                "resultType": "core",
            }
        )
        d = json.loads(get(f"{API}/search?{q}"))
        for r in d["resultList"]["result"]:
            rows.append(
                {
                    "pmid": r.get("pmid", ""),
                    "pmcid": r.get("pmcid", ""),
                    "doi": r.get("doi", ""),
                    "year": r.get("pubYear", ""),
                    "title": r.get("title", ""),
                    "journal": r.get("journalInfo", {})
                    .get("journal", {})
                    .get("title", ""),
                    "open_access": r.get("isOpenAccess", ""),
                    "in_epmc": r.get("inEPMC", ""),
                    "has_suppl": r.get("hasSuppl", ""),
                    "authors": r.get("authorString", "")[:2000],
                }
            )
        nxt = d.get("nextCursorMark")
        if not nxt or nxt == cursor or not d["resultList"]["result"]:
            return rows
        cursor = nxt


def s3_objects(pmcid):
    body = get(f"{S3}/?list-type=2&prefix={pmcid}.&max-keys=500", timeout=60).decode()
    keys = re.findall(r"<Contents><Key>([^<]+)</Key>.*?<Size>(\d+)</Size>", body)
    if not keys:
        return []
    # several versions (PMCxxx.1/, PMCxxx.2/): keep the latest
    latest = max(
        {k.split("/")[0] for k, _ in keys}, key=lambda v: int(v.rsplit(".", 1)[1])
    )
    return [(k, int(s)) for k, s in keys if k.startswith(latest + "/")]


def fetch(row, out, max_bytes):
    pmcid = row["pmcid"]
    d = os.path.join(out, "files", pmcid)
    if os.path.exists(os.path.join(d, ".done")):
        return pmcid, "cached"
    os.makedirs(d, exist_ok=True)
    try:
        objs = s3_objects(pmcid)
    except Exception as e:  # noqa: BLE001
        objs = []
        print(f"{pmcid} s3 list: {e}", file=sys.stderr)
    got = 0
    for key, size in objs:
        name = key.split("/", 1)[1]
        # the article PDF duplicates the XML; supplements are what we want
        if (
            not KEEP.search(name)
            or name == f"{key.split('/')[0]}.pdf"
            or size > max_bytes
        ):
            continue
        try:
            with open(os.path.join(d, name), "wb") as f:
                f.write(get(f"{S3}/{urllib.parse.quote(key)}", timeout=300))
            got += 1
        except Exception as e:  # noqa: BLE001
            print(f"{pmcid} {name}: {e}", file=sys.stderr)
    status = f"s3:{got}"
    if not any(n.endswith(".xml") for n in os.listdir(d)) and row["in_epmc"] == "Y":
        try:
            with open(os.path.join(d, f"{pmcid}.xml"), "wb") as f:
                f.write(get(f"{API}/{pmcid}/fullTextXML"))
            status += "+epmc_xml"
        except Exception as e:  # noqa: BLE001
            print(f"{pmcid} epmc xml: {e}", file=sys.stderr)
        time.sleep(0.2)
    with open(os.path.join(d, ".done"), "w"):
        pass
    return pmcid, status


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--max-file-mb", type=int, default=40)
    ap.add_argument("--threads", type=int, default=8)
    args = ap.parse_args()
    os.makedirs(os.path.join(args.out, "files"), exist_ok=True)
    rows = search()
    with open(
        os.path.join(args.out, "papers.tsv"), "w", newline="", encoding="utf-8"
    ) as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, delimiter="\t")
        w.writeheader()
        w.writerows(rows)
    todo = [r for r in rows if r["pmcid"]]
    print(f"{len(rows)} papers, {len(todo)} with a PMCID", file=sys.stderr)
    with ThreadPoolExecutor(args.threads) as pool:
        for n, (pmcid, status) in enumerate(
            pool.map(lambda r: fetch(r, args.out, args.max_file_mb << 20), todo)
        ):
            if n % 50 == 0:
                print(f"{n} {pmcid} {status}", file=sys.stderr)
    print("done", file=sys.stderr)


if __name__ == "__main__":
    main()
