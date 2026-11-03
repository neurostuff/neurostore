"""Named cohorts per ENIGMA paper, from its sample tables, with the working group taken from the title or abstract.

usage: python -I enigma_cohorts.py API_URL EPMC_DIR OUT_PAPERS.tsv OUT_GROUPS.tsv
"""

import csv
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from enigma import MENTION, group_at  # noqa: E402
from enigma_samples import clean, keep  # noqa: E402
from match import key, load_dictionary, read_tsv  # noqa: E402


def paper_group(title, xml_path):
    """Working group named in the title, else the one named most often in the abstract, else in the full text."""
    texts = [title]
    if os.path.exists(xml_path):
        try:
            root = ET.parse(xml_path).getroot()
            texts += [
                " ".join(" ".join(a.itertext()) for a in root.iter("abstract")),
                " ".join(root.itertext()),
            ]
        except ET.ParseError:
            pass  # unparsable full text: the group is looked for in the title alone
    for text in texts:
        groups = Counter(
            g for g in (group_at(text, m)[0] for m in MENTION.finditer(text)) if g
        )
        if groups:
            return groups.most_common(1)[0][0]
    return ""


def main():
    dict_path, epmc, out_papers, out_groups = sys.argv[1:5]
    entities, names, acronyms, _, _ = load_dictionary(dict_path)
    by_key = dict(names)
    for acr, ents in acronyms.items():
        by_key.setdefault(key(acr), ents[0][0])
    papers = {
        r["pmcid"]: r for r in read_tsv(os.path.join(epmc, "papers.tsv")) if r["pmcid"]
    }
    cohorts, labels = defaultdict(set), defaultdict(set)
    for r in read_tsv(os.path.join(epmc, "cells.tsv")):
        name = clean(r["cell"])
        if not keep(name):
            continue
        labels[r["pmcid"]].add(name)
        # "SHIP-Trend", "NTR (2)", "FOR2107 MR": try the label, then its first token
        for cand in (name, re.split(r"[\s_(\-]", name)[0]):
            ent = by_key.get(key(cand))
            if ent:
                cohorts[r["pmcid"]].add(ent)
                break
    by_group = defaultdict(lambda: defaultdict(set))
    with open(out_papers, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow(
            [
                "pmcid",
                "pmid",
                "year",
                "title",
                "working_group",
                "n_labels",
                "cohorts",
                "labels",
            ]
        )
        for pmcid in sorted(labels):
            p = papers[pmcid]
            d = os.path.join(epmc, "files", pmcid)
            xml = next(
                (
                    os.path.join(d, n)
                    for n in sorted(os.listdir(d))
                    if n.endswith(".xml")
                ),
                "",
            )
            group = paper_group(p["title"], xml)
            names_ = sorted(entities[e]["name"] for e in cohorts[pmcid])
            for e in cohorts[pmcid]:
                by_group[group or "unknown"][e].add(pmcid)
            w.writerow(
                [
                    pmcid,
                    p["pmid"],
                    p["year"],
                    p["title"][:200],
                    group,
                    len(labels[pmcid]),
                    "; ".join(names_),
                    "; ".join(sorted(labels[pmcid]))[:3000],
                ]
            )
    with open(out_groups, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow(["working_group", "cohort_id", "cohort", "papers"])
        for g in sorted(by_group):
            for e, ps in sorted(by_group[g].items(), key=lambda kv: -len(kv[1])):
                w.writerow([g, e, entities[e]["name"], len(ps)])
    print(
        f"{len(labels)} papers with sample tables, {sum(bool(c) for c in cohorts.values())} with named cohorts, "
        f"{len({e for c in cohorts.values() for e in c})} distinct cohorts",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
