"""Sample names from ENIGMA sample tables, counted across papers and checked against the dictionary.

usage: python -I enigma_samples.py API_URL CELLS.tsv OUT.tsv

CELLS.tsv is the output of enigma_tables.py. A name is kept when it looks like a label (short, has a letter, is not
a statistic, diagnosis or column word).
"""

import csv
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match import key, load_dictionary, read_tsv  # noqa: E402

FOOTNOTE = re.compile(
    r"[\*†‡§¶#¹²³⁴⁵⁶⁷⁸⁹⁰]+|\s*\((?:n|N)\s*=\s*[\d,]+\)|\s*\[\d+(?:[,–-]\d+)*\]$|\s+[a-h]$"
)
NOT_SAMPLE = re.compile(
    r"^(?:total|overall|all|sum|mean|median|sd|range|n|age|sex|gender|female|male|females|males|women|men|missing|"
    r"yes|no|none|other|unknown|left|right|controls?|cases?|patients?|hc|hcs|mdd|bd|bd-?i+|sz|scz|ocd|adhd|asd|"
    r"ptsd|tbi|ad|mci|pd|hiv|cn|nc|td|euthymic|depressed|manic|hypomanic|mixed|lithium|antidepressants?|"
    r"antipsychotics?|medicat\w*|unmedicated|medicated|white|black|asian|hispanic|caucasian|european|african|"
    r"handedness|education|iq|scanner|siemens|ge|philips|field strength|t1|dti|1\.5t|3t|7t|freesurfer|fsl|"
    r"site|sites|sample|samples|cohort|cohorts|study|studies|dataset|datasets|subtotal|adults?|children|"
    r"adolescents?|pediatric|paediatric|youth|discovery|replication|training|test|validation|meta-analysis|"
    r"mega-analysis|europe|north america|south america|asia|oceania|australia|africa|usa|us|uk|china|"
    r"germany|netherlands|italy|spain|brazil|canada|japan|france|norway|sweden|switzerland|korea|india|"
    r"south africa|ireland|belgium|denmark|finland|israel|mexico|chile|argentina|turkey|iran|taiwan|singapore|"
    r"new zealand|austria|poland|greece|portugal|hungary|czech republic|russia|hong kong)$",
    re.I,
)
STAT = re.compile(
    r"^[\d\s.,;:%±()\-–<>=/+pPrRtTzZβ]*$|^\d|%|±|\bp\s*[<=]|\bvs\.?\b|\bmean\b|\bSD\b",
    re.I,
)
FIELDS = [
    "name",
    "key",
    "papers",
    "known",
    "dictionary_id",
    "variants",
    "pmcids",
    "example_row",
    "example_title",
]


def clean(cell):
    cell = re.sub(r"\s+", " ", FOOTNOTE.sub("", cell)).strip(" ,;:-–")
    return cell


def keep(name):
    return (
        2 <= len(name) <= 60
        and re.search(r"[A-Za-z]{2}", name)
        and not NOT_SAMPLE.match(name)
        and not STAT.search(name)
        and len(name.split()) <= 8
    )


def main():
    dict_path, cells_path, out = sys.argv[1:4]
    entities, names, acronyms, _, _ = load_dictionary(dict_path)
    by_key = {}
    for k, ent in names.items():
        by_key.setdefault(k, ent if isinstance(ent, str) else ent[0])
    for acr, ents in acronyms.items():
        by_key.setdefault(key(acr), ents[0][0])
    found = defaultdict(
        lambda: {"papers": set(), "variants": defaultdict(int), "row": "", "title": ""}
    )
    for r in read_tsv(cells_path):
        name = clean(r["cell"])
        if not keep(name):
            continue
        d = found[key(name)]
        d["papers"].add(r["pmcid"])
        d["variants"][name] += 1
        if not d["row"]:
            d["row"], d["title"] = r["row"][:200], r["title"][:120]
    rows = []
    for k, d in found.items():
        variants = sorted(d["variants"], key=lambda v: -d["variants"][v])
        ent = by_key.get(k, "")
        rows.append(
            {
                "name": variants[0],
                "key": k,
                "papers": len(d["papers"]),
                "known": "yes" if ent else "",
                "dictionary_id": ent,
                "variants": "|".join(variants[:6]),
                "pmcids": ";".join(sorted(d["papers"])[:10]),
                "example_row": d["row"],
                "example_title": d["title"],
            }
        )
    rows.sort(key=lambda r: (-r["papers"], r["name"]))
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, delimiter="\t")
        w.writeheader()
        w.writerows(rows)
    print(
        f"{len(rows)} names, {sum(r['papers'] >= 2 for r in rows)} in >= 2 papers, "
        f"{sum(bool(r['known']) for r in rows)} known",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
