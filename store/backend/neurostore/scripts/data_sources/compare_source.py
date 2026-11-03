"""Rows of a source TSV (name, acronym columns) split into known / new against the dictionary.

usage: python -I compare_source.py API_URL SOURCE.tsv [FILTER_COLUMN]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match import key, load_dictionary, read_tsv  # noqa: E402

entities, names, acronyms, _, _ = load_dictionary(sys.argv[1])
known = set(names) | {key(e["name"]) for e in entities.values()}
known_acr = {key(a) for a in acronyms}
col = sys.argv[3] if len(sys.argv) > 3 else None
for r in read_tsv(sys.argv[2]):
    if col and not any(
        t in r[col] for t in ("MRI", "PET", "Magnetic resonance", "Positron")
    ):
        continue
    hit = key(r["name"]) in known or (r["acronym"] and key(r["acronym"]) in known_acr)
    print(
        "KNOWN" if hit else "NEW  ",
        r["acronym"] or "-",
        "|",
        r["name"],
        "|",
        r.get("countries", ""),
        "|",
        r.get(col, "") if col else "",
        sep=" ",
    )
