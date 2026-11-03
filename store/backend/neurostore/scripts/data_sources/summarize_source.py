"""Matcher counts for the data sources listed in one catalogue.

usage: python -I summarize_source.py API_URL SUMMARY.tsv SOURCE

SUMMARY.tsv is match.py's entity_summary.tsv; SOURCE is a catalogue named in listed_in (jpnd, cosmic, ...).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match import read_dictionary_rows, read_tsv, split  # noqa: E402

api, summary, source = sys.argv[1:4]
d = {r["id"]: r for r in read_dictionary_rows(api)}
s = {r["entity"]: r for r in read_tsv(summary)}
ids = [k for k, r in d.items() if source in split(r["source"])]
print(
    f"{source} entries matched: {sum(k in s for k in ids)}/{len(ids)}; not found: {[k for k in ids if k not in s]}"
)
for k in sorted((k for k in ids if k in s), key=lambda k: -int(s[k]["papers_total"])):
    r = s[k]
    print(
        f"{k:22s} total={r['papers_total']:>4} used={r['used']:>4} mentioned={r['mentioned']:>3} "
        f"unsectioned={r['unsectioned']:>3} refs={r['references_only']:>3}"
    )
