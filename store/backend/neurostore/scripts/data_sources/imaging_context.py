"""How often each discovered name appears next to MRI/PET wording, to vet candidates before they enter the dictionary.

usage: python -I imaging_context.py DISCOVERED.tsv OUT.tsv ROOT [ROOT ...] [--workers N]
"""

import argparse
import csv
import os
import re
import sys
from collections import defaultdict
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match import alias_pattern, key, pick_text, read_tsv, snippet  # noqa: E402

IMAGING = re.compile(
    r"\b(?:MRI|fMRI|MR imaging|magnetic resonance|PET|positron|neuroimaging|brain imaging|DTI|"
    r"diffusion|T1-weighted|T2-weighted|scann(?:er|ed|ing)|scans?|voxel|amyloid|tau imaging)\b",
    re.I,
)
WINDOW = 400


def init(path):
    global NAME_RE, NAMES
    names = [r["name"] for r in read_tsv(path)]
    NAMES = {key(n): n for n in names}
    NAME_RE = re.compile(
        r"(?<!\w)(?:"
        + "|".join(sorted((alias_pattern(n) for n in names), key=len, reverse=True))
        + r")(?!\w)",
        re.I,
    )


def search(paper_dir):
    picked = pick_text(paper_dir)
    if picked is None:
        return []
    with open(picked[2], encoding="utf-8", errors="replace") as f:
        text = f.read()
    seen = {}
    for m in NAME_RE.finditer(text):
        name = NAMES.get(key(m.group()))
        if not name:
            continue
        near = IMAGING.search(
            text, max(0, m.start() - WINDOW), min(len(text), m.end() + WINDOW)
        )
        if name not in seen or (near and not seen[name][0]):
            seen[name] = (bool(near), snippet(text, m.start(), m.end()) if near else "")
    return [(name, near, snip) for name, (near, snip) in seen.items()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("discovered")
    ap.add_argument("out")
    ap.add_argument("roots", nargs="+")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    dirs = sorted(os.path.join(r, d) for r in args.roots for d in os.listdir(r))
    stats = defaultdict(lambda: [0, 0, ""])
    with Pool(args.workers, initializer=init, initargs=(args.discovered,)) as pool:
        for rows in pool.imap_unordered(search, dirs, chunksize=32):
            for name, near, snip in rows:
                s = stats[name]
                s[0] += 1
                s[1] += near
                if near and not s[2]:
                    s[2] = snip
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow(["name", "papers", "papers_near_imaging", "imaging_snippet"])
        for name, (n, near, snip) in sorted(stats.items(), key=lambda kv: -kv[1][0]):
            w.writerow([name, n, near, snip])


if __name__ == "__main__":
    main()
