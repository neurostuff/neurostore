"""Find neuroimaging studies, consortia and repositories named in ns-pond full text.

usage: python -I match.py API_URL OUT_DIR ROOT [ROOT ...] [--workers N] [--limit N]

API_URL is the neurostore API whose /data-sources/ are searched for, e.g. https://neurostore.org/api.

Each ROOT holds one directory per paper with processed/<source>/text.txt; the longest
text per paper is searched. Writes paper_entities.tsv, entity_summary.tsv, hits.jsonl
and run.json to OUT_DIR.
"""

import argparse
import csv
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from multiprocessing import Pool

SEP = r"[\s\-‐‑–—]+"
CUE = re.compile(
    r"\b(?:data(?:sets?|base)?|cohorts?|samples?|stud(?:y|ies)|consortium|participants?|subjects?|"
    r"obtained|downloaded|release|initiative|project|repository|archive|sites?|scans?|imaging|"
    r"wave|baseline|follow-up)\b",
    re.I,
)
CUE_WINDOW = 80
# qualified names ("Narratives", "Sherlock") are ordinary words; they count only next to a dataset word,
# near an OpenNeuro accession, or when the entry's full name appears in the paper
# at most two words between the name and the dataset word: "Sherlock movie-watching data", "Sherlock (fMRI dataset"
QUALIFIER_AFTER = re.compile(
    r"(?:[\s(\-]+[\w'\u2019\-]+){0,2}?[\s(\-]+"
    r"(?:data ?sets?|data|corpus|collection|database|repository|challenge|platform)\b",
    re.I,
)
QUALIFIER_BEFORE = re.compile(
    r"\b(?:data ?sets?|corpus|collection|database|repository|platform)\b[^.\n]{0,20}$",
    re.I,
)
OPENNEURO_ACCESSION = re.compile(r"\bds\d{6}\b")
QUALIFIER_WINDOW = 100
SNIPPET = 120
MAX_SNIPPETS = 3

SECTIONS = [
    (
        "references",
        r"references?|bibliography|literature cited|works cited|reference list",
    ),
    (
        "data_availability",
        r"data availability(?: statement)?|data and code availability|code availability|"
        r"availability of data(?: and materials?)?|data sharing(?: statement)?|"
        r"data accessibility|resource availability|data and software availability",
    ),
    (
        "acknowledgments",
        r"acknowledge?ments?|funding(?: information| sources?)?|financial support|"
        r"sources? of funding",
    ),
    (
        "methods",
        r"(?:materials? and |patients and |subjects and |online |star ?)?methods?(?: and materials?)?|"
        r"methodology|experimental procedures?|participants|subjects|patients|study population|"
        r"study design",
    ),
    ("results", r"results(?: and discussion)?"),
    ("discussion", r"(?:general )?discussion"),
    ("conclusion", r"conclusions?|concluding remarks"),
    ("intro", r"introduction|background"),
    ("abstract", r"abstract|summary"),
]
HEADING = re.compile(
    r"^(?:#{1,6}\s*)?\**(?:\d+(?:\.\d+)*\.?\s+|[IVX]+\.\s+)?(?:"
    + "|".join(f"(?P<{k}>{p})" for k, p in SECTIONS)
    + r")\**\s*:?\**$",
    re.I,
)
USED = {
    "front",
    "abstract",
    "methods",
    "results",
    "data_availability",
    "acknowledgments",
}
MENTIONED = {"intro", "discussion", "conclusion"}


def key(s):
    return re.sub(r"[^a-z0-9]", "", s.lower().replace("’", "'").replace("'s", "s"))


def alias_pattern(alias):
    tokens = [
        re.escape(t).replace("'", "['’]?") for t in re.split(SEP, alias.strip()) if t
    ]
    return SEP.join(tokens)


def split(cell):
    return [x.strip() for x in (cell or "").split("|") if x.strip()]


ALIAS_COLUMNS = {
    "name": "full_names",
    "safe": "acronyms_safe",
    "context": "acronyms_context",
    "defined": "acronyms_defined",
    "qualified": "qualified_names",
}


def read_dictionary_rows(api):
    """Every data source from a neurostore API (e.g. https://neurostore.org/api), as dictionary rows."""
    return dictionary_rows(fetch_data_sources(api))


def fetch_data_sources(api):
    records, page = [], 1
    while True:
        query = urllib.parse.urlencode(
            {"page": page, "page_size": 1000, "sort": "slug", "desc": "false"}
        )
        with urllib.request.urlopen(
            f"{api.rstrip('/')}/data-sources/?{query}", timeout=120
        ) as r:
            body = json.load(r)
        records += body["results"]
        if not body["results"] or len(records) >= body["metadata"]["total_count"]:
            break
        page += 1
    return records


def dictionary_rows(records):
    """/data-sources/ records as rows with the dictionary TSV's columns: id is the slug, hosted_by the
    parent's slug, and each alias tier a '|'-joined column."""
    slug_of = {r["id"]: r["slug"] for r in records}
    rows = []
    for r in records:
        row = {
            "id": r["slug"],
            "name": r["name"],
            "roles": "|".join(r.get("kinds") or []),
            "modality": "|".join(r.get("modalities") or []),
            "hosted_by": slug_of.get(r.get("part_of"), ""),
            "rrid": "|".join(r.get("rrids") or []),
            "re3data_id": "|".join(r.get("re3data_ids") or []),
            "source": "|".join(r.get("listed_in") or []),
            "url": r.get("url") or "",
        }
        for tier, column in ALIAS_COLUMNS.items():
            row[column] = "|".join(
                a["alias"] for a in r.get("aliases") or [] if a["tier"] == tier
            )
        rows.append(row)
    return rows


def load_dictionary(api):
    return build_dictionary(read_dictionary_rows(api))


def build_dictionary(rows):
    entities, names, acronyms = {}, {}, {}
    for row in rows:
        entities[row["id"]] = row
        for alias in split(row["full_names"]):
            names.setdefault(key(alias), row["id"])
        # one string may name several entries (IDEAS: amyloid PET study and epilepsy dataset); each keeps its tier
        for tier, column in (
            ("safe", "acronyms_safe"),
            ("context", "acronyms_context"),
            ("defined", "acronyms_defined"),
            ("qualified", "qualified_names"),
        ):
            for acr in split(row.get(column)):
                if (row["id"], tier) not in acronyms.setdefault(acr, []):
                    acronyms[acr].append((row["id"], tier))
    name_alts = sorted(
        {alias_pattern(a) for r in entities.values() for a in split(r["full_names"])},
        key=len,
        reverse=True,
    )
    acr_alts = sorted((re.escape(a) for a in acronyms), key=len, reverse=True)
    name_re = re.compile(r"(?<!\w)(?:" + "|".join(name_alts) + r")(?!\w)", re.I)
    acr_re = re.compile(r"(?<![\w\-])(?:" + "|".join(acr_alts) + r")(?!\w)")
    return entities, names, acronyms, name_re, acr_re


def qualified(text, start, end):
    # the accession must be in the same sentence: neighbouring sentences often cite other datasets
    lo = max(
        text.rfind(".", 0, start) + 1,
        text.rfind("\n", 0, start) + 1,
        start - QUALIFIER_WINDOW,
    )
    stops = [i for i in (text.find(". ", end), text.find("\n", end)) if i >= 0]
    hi = min(stops + [end + QUALIFIER_WINDOW])
    return bool(
        QUALIFIER_AFTER.match(text, end)
        or QUALIFIER_BEFORE.search(text, max(0, start - 40), start)
        or OPENNEURO_ACCESSION.search(text, lo, hi)
    )


def sections(text):
    """[(start, section)] boundaries; the first is 'front' when any heading is found, else 'body'."""
    marks, pos = [], 0
    for line in text.splitlines(keepends=True):
        s = line.strip()
        if s and len(s) <= 60 and len(s.split()) <= 6:
            m = HEADING.match(s)
            if m:
                marks.append((pos, m.lastgroup))
        pos += len(line)
    return [(0, "front" if marks else "body")] + marks


def section_at(marks, offset):
    sec = marks[0][1]
    for start, name in marks:
        if start > offset:
            break
        sec = name
    return sec


def pick_text(paper_dir):
    best = None
    processed = os.path.join(paper_dir, "processed")
    for source in os.listdir(processed) if os.path.isdir(processed) else []:
        path = os.path.join(processed, source, "text.txt")
        if os.path.isfile(path):
            size = os.path.getsize(path)
            if best is None or size > best[0]:
                best = (size, source, path)
    return best


def read_tsv(path):
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def read_lines(path):
    with open(path, encoding="utf-8") as f:
        return f.read().splitlines()


def read_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def snippet(text, start, end):
    return re.sub(r"\s+", " ", text[max(0, start - SNIPPET) : end + SNIPPET])


def search(paper_dir):
    picked = pick_text(paper_dir)
    if picked is None:
        return None
    _, source, path = picked
    with open(path, encoding="utf-8", errors="replace") as f:
        text = f.read()
    ids = read_json(os.path.join(paper_dir, "identifiers.json"))
    meta = read_json(os.path.join(paper_dir, "processed", source, "metadata.json"))
    paper = {
        "paper": os.path.basename(paper_dir),
        "pmid": ids.get("pmid") or "",
        "doi": ids.get("doi") or "",
        "year": meta.get("publication_year") or "",
        "source": source,
    }
    marks = sections(text)
    sectioned = marks[0][1] == "front"

    raw = []  # (entity, form, tier, start, end, section)
    for m in NAME_RE.finditer(text):
        ent = NAMES.get(key(m.group()))
        # all-lowercase multi-word matches are prose ("adolescent brain and cognitive development")
        if ent and not (m.group().islower() and re.search(r"\s", m.group())):
            raw.append(
                (
                    ent,
                    m.group(),
                    "name",
                    m.start(),
                    m.end(),
                    section_at(marks, m.start()),
                )
            )
    for m in ACR_RE.finditer(text):
        for ent, tier in ACRONYMS[m.group()]:
            raw.append(
                (ent, m.group(), tier, m.start(), m.end(), section_at(marks, m.start()))
            )
    defined = {h[0] for h in raw if h[2] == "name" and h[5] != "references"}

    hits = defaultdict(list)
    for ent, form, tier, start, end, sec in raw:
        if tier == "defined" and ent not in defined:
            continue
        if (
            tier == "context"
            and ent not in defined
            and not CUE.search(
                text, max(0, start - CUE_WINDOW), min(len(text), end + CUE_WINDOW)
            )
        ):
            continue
        if (
            tier == "qualified"
            and ent not in defined
            and not qualified(text, start, end)
        ):
            continue
        hits[ent].append((form, tier, start, end, sec))

    rows, hit_rows = [], []
    for ent, hs in hits.items():
        secs = Counter(h[4] for h in hs)
        if not sectioned:
            status = "unsectioned"
        elif USED & secs.keys():
            status = "used"
        elif MENTIONED & secs.keys():
            status = "mentioned"
        else:
            status = "references_only"
        rows.append(
            {
                **paper,
                "entity": ent,
                "status": status,
                "n_hits": len(hs),
                "sections": ";".join(f"{s}:{n}" for s, n in secs.most_common()),
                "forms": ";".join(sorted({h[0] for h in hs})),
            }
        )
        ranked = sorted(
            hs, key=lambda h: (h[4] not in USED, h[4] == "references", h[2])
        )
        for form, tier, start, end, sec in ranked[:MAX_SNIPPETS]:
            hit_rows.append(
                {
                    "paper": paper["paper"],
                    "entity": ent,
                    "form": form,
                    "tier": tier,
                    "section": sec,
                    "offset": start,
                    "snippet": snippet(text, start, end),
                }
            )

    return {"paper": paper, "sectioned": sectioned, "rows": rows, "hits": hit_rows}


def init(rows):
    global NAMES, ACRONYMS, NAME_RE, ACR_RE
    _, NAMES, ACRONYMS, NAME_RE, ACR_RE = build_dictionary(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dictionary")
    ap.add_argument("out")
    ap.add_argument("roots", nargs="+")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    rows = read_dictionary_rows(args.dictionary)
    entities = build_dictionary(rows)[0]
    dirs = sorted(os.path.join(r, d) for r in args.roots for d in os.listdir(r))
    if args.limit:
        dirs = dirs[: args.limit]
    os.makedirs(args.out, exist_ok=True)

    papers = sectioned = 0
    status = defaultdict(Counter)
    fields = [
        "paper",
        "pmid",
        "doi",
        "year",
        "source",
        "entity",
        "status",
        "n_hits",
        "sections",
        "forms",
    ]
    with open(
        os.path.join(args.out, "paper_entities.tsv"), "w", newline="", encoding="utf-8"
    ) as pe, open(
        os.path.join(args.out, "hits.jsonl"), "w", encoding="utf-8"
    ) as hj, Pool(
        args.workers, initializer=init, initargs=(rows,)
    ) as pool:
        writer = csv.DictWriter(pe, fieldnames=fields, delimiter="\t")
        writer.writeheader()
        for i, res in enumerate(pool.imap_unordered(search, dirs, chunksize=32), 1):
            if i % 5000 == 0:
                print(f"{i:,}/{len(dirs):,}", file=sys.stderr, flush=True)
            if res is None:
                continue
            papers += 1
            sectioned += res["sectioned"]
            writer.writerows(res["rows"])
            for r in res["rows"]:
                status[r["entity"]][r["status"]] += 1
            hj.writelines(json.dumps(h, ensure_ascii=False) + "\n" for h in res["hits"])

    with open(
        os.path.join(args.out, "entity_summary.tsv"), "w", newline="", encoding="utf-8"
    ) as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow(
            [
                "entity",
                "name",
                "roles",
                "modality",
                "hosted_by",
                "url",
                "papers_total",
                "used",
                "mentioned",
                "unsectioned",
                "references_only",
            ]
        )
        for ent, c in sorted(status.items(), key=lambda kv: -sum(kv[1].values())):
            e = entities[ent]
            w.writerow(
                [
                    ent,
                    e["name"],
                    e["roles"],
                    e["modality"],
                    e["hosted_by"] or "",
                    e.get("url") or "",
                    sum(c.values()),
                    c["used"],
                    c["mentioned"],
                    c["unsectioned"],
                    c["references_only"],
                ]
            )

    with open(os.path.join(args.out, "run.json"), "w") as f:
        json.dump(
            {
                "dictionary": args.dictionary,
                "roots": args.roots,
                "paper_dirs": len(dirs),
                "papers_with_text": papers,
                "papers_sectioned": sectioned,
                "entities_found": len(status),
            },
            f,
            indent=2,
        )
    print(
        f"{papers:,} papers with text, {sectioned:,} sectioned, {len(status)} entities found",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
