"""NDA collections and NDA study DOIs cited in ns-pond full text, mapped to collection titles.

usage: python -I nda_refs.py COLLECTIONS.tsv OUT.tsv ROOT [ROOT ...] [--workers N]

COLLECTIONS.tsv has columns id, title, imaging (1 when the collection's description mentions MRI/PET/imaging).
"""

import argparse
import csv
import os
import re
import sys
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match import (
    pick_text,
    read_json,
    read_tsv,
    section_at,
    sections,
    snippet,
)  # noqa: E402

COLLECTION = re.compile(
    r"edit_collection\.html\?id=(?P<a>\d{2,5})|"
    r"\b(?:NDA|NIMH Data Archive|NDAR)\b[^.\n]{0,60}?\bcollections?\b[^.\n]{0,15}?(?:#|C|number|ID|id)?\s*:?\s*(?P<b>\d{3,5})\b|"
    r"\bcollection\s*(?:#\s?|C)(?P<c>\d{3,5})\b"
)
NDA_NEAR = re.compile(r"\bNDA\b|NIMH Data Archive|NDAR|nda\.nih\.gov")
DOI = re.compile(r"\b10\.15154/[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*")
FIELDS = [
    "paper",
    "pmid",
    "doi",
    "year",
    "ref",
    "kind",
    "title",
    "imaging",
    "section",
    "snippet",
]


def init(path):
    global COLLECTIONS
    COLLECTIONS = {r["id"]: r for r in read_tsv(path)}


def search(paper_dir):
    picked = pick_text(paper_dir)
    if picked is None:
        return []
    with open(picked[2], encoding="utf-8", errors="replace") as f:
        text = f.read()
    if "15154" not in text and not NDA_NEAR.search(text):
        return []
    marks = sections(text)
    found = {}
    for m in COLLECTION.finditer(text):
        cid = m.group("a") or m.group("b") or m.group("c")
        # bare "collection #1234" counts only near an NDA mention
        if m.group("c") and not NDA_NEAR.search(
            text, max(0, m.start() - 200), m.end() + 200
        ):
            continue
        found.setdefault(("collection", cid), m)
    for m in DOI.finditer(text):
        found.setdefault(("doi", m.group()), m)
    if not found:
        return []
    ids = read_json(os.path.join(paper_dir, "identifiers.json"))
    meta = read_json(os.path.join(paper_dir, "processed", picked[1], "metadata.json"))
    rows = []
    for (kind, ref), m in found.items():
        c = COLLECTIONS.get(ref, {}) if kind == "collection" else {}
        rows.append(
            {
                "paper": os.path.basename(paper_dir),
                "pmid": ids.get("pmid") or "",
                "doi": ids.get("doi") or "",
                "year": meta.get("publication_year") or "",
                "ref": ref,
                "kind": kind,
                "title": c.get("title", ""),
                "imaging": c.get("imaging", ""),
                "section": section_at(marks, m.start()),
                "snippet": snippet(text, m.start(), m.end()),
            }
        )
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("collections")
    ap.add_argument("out")
    ap.add_argument("roots", nargs="+")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    dirs = sorted(os.path.join(r, d) for r in args.roots for d in os.listdir(r))
    papers = n = 0
    with open(args.out, "w", newline="", encoding="utf-8") as f, Pool(
        args.workers, initializer=init, initargs=(args.collections,)
    ) as pool:
        w = csv.DictWriter(f, fieldnames=FIELDS, delimiter="\t")
        w.writeheader()
        for rows in pool.imap_unordered(search, dirs, chunksize=32):
            if rows:
                papers += 1
                n += len(rows)
                w.writerows(rows)
    print(f"{papers:,} papers cite {n:,} NDA collections or DOIs", file=sys.stderr)


if __name__ == "__main__":
    main()
