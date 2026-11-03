"""ENIGMA papers in ns-pond full text, with working group and relationship to ENIGMA.

usage: python -I enigma.py OUT.tsv ROOT [ROOT ...] [--workers N]

role, strongest first:
  working_group    credited to an ENIGMA working group or the consortium ("for the ENIGMA-OCD Working Group")
                   in front matter, abstract, methods or acknowledgments
  summary_stats    uses ENIGMA summary statistics (GWAS results, ENIGMA Toolbox maps)
  protocol         methods use ENIGMA protocols, pipelines, QC or tools (HALFpipe, VBM tool)
  mentioned        ENIGMA named outside references, without either of the above
  references_only  ENIGMA only in the reference list
"""

import argparse
import csv
import os
import re
import sys
from collections import Counter
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match import pick_text, read_json, section_at, sections, snippet  # noqa: E402

# Working groups listed at https://enigma.ini.usc.edu/ongoing/ (2026-11-02), plus the genetics projects.
# Order matters: the first pattern that matches the phrase after "ENIGMA" wins.
GROUPS = [
    ("PTSD", r"PTSD|post-?traumatic"),
    ("Schizotypy", r"schizotyp"),
    ("Schizophrenia", r"schizo|\bSZ\b|\bSCZ\b"),
    ("Clinical High Risk", r"clinical high.risk|\bCHR\b"),
    ("Early Onset Psychosis", r"early.onset psychosis|\bEOP\b"),
    ("Bipolar", r"bipolar|\bBD\b"),
    ("MDD", r"\bMDD\b|depress"),
    ("OCD", r"\bOCD\b|obsessive"),
    ("ADHD", r"ADHD"),
    ("Autism", r"autis|\bASD\b"),
    ("Anxiety", r"anxiety|panic|\bGAD\b|\bSAD\b"),
    ("Addiction", r"addiction|substance|\bSUD\b|alcohol"),
    ("Experimental Cannabinoids", r"cannabi"),
    ("Antisocial Behavior", r"antisocial|conduct"),
    ("Eating Disorders", r"eating|anorexia|bulimi"),
    ("Tourette Syndrome", r"tourette|\btic"),
    ("Irritability", r"irritab"),
    ("Dissociation", r"dissociat"),
    ("STB", r"\bSTB\b|suicid"),
    ("Stress & Resilience", r"stress|resilien"),
    ("Epilepsy", r"epilep"),
    ("Parkinson's", r"parkinson|\bPD\b"),
    ("Frontotemporal Dementia", r"frontotemporal|\bFTD\b"),
    ("Ataxia", r"ataxia"),
    ("Tremor", r"tremor"),
    ("Stroke Recovery", r"stroke"),
    ("cSVD", r"cSVD|small.vessel"),
    ("Brain Injury", r"\bTBI\b|brain injur|concussion|\bmsTBI\b"),
    ("HIV", r"\bHIV\b"),
    ("Chronic Pain", r"\bpain"),
    ("Cancer & Chemotherapy", r"cancer|chemo"),
    ("Diabetes", r"diabet"),
    ("Storage Diseases", r"storage"),
    ("Sleep", r"sleep|insomnia"),
    ("22q", r"22q"),
    ("CNV", r"\bCNV|copy.number"),
    ("DTI", r"\bDTI\b|diffusion"),
    ("Shape Analysis", r"shape"),
    ("rsfMRI", r"rs-?fMRI|resting"),
    ("tbfMRI", r"tb-?fMRI|task"),
    ("EEG", r"\bEEG\b"),
    ("MEG", r"\bMEG\b"),
    ("Ultra Low Field", r"low.field"),
    ("Hippocampal Subfields", r"subfield"),
    ("Gyrification", r"gyrification"),
    ("Gradient", r"gradient"),
    ("Brain Age", r"brain.?age"),
    ("Lifespan", r"lifespan"),
    ("Laterality", r"laterality|asymmetr"),
    ("Language", r"language"),
    ("Relatives", r"relatives|familial"),
    ("Plasticity", r"plasticity"),
    ("Neuromodulation", r"neuromodulation|\bECT\b|\bTMS\b"),
    ("Neurofeedback", r"neurofeedback"),
    ("Meditation", r"meditation"),
    ("Neuroendocrinology", r"endocrin"),
    ("Environment", r"environment"),
    ("Epigenetics", r"epigenetic|methylation"),
    ("Evolution", r"evolution"),
    ("ORIGINs", r"ORIGIN"),
    ("Social Health", r"social health"),
    ("BMIX", r"BMIX"),
    ("MRS", r"\bMRS\b|spectroscopy"),
    ("Genetics", r"^(?:2|3|CHARGE|genetic|GWAS|plasticity genetics)\b|^ENIGMA[23]$"),
]
GROUPS = [(name, re.compile(p, re.I)) for name, p in GROUPS]

# case-sensitive acronym: lowercase "enigma" is the ordinary word
MENTION = re.compile(
    r"(?<![\w\-])ENIGMA[23]?\b|(?i:Enhancing Neuro ?Imaging Genetics (?:through|by) Meta-?Analysis)"
)
# the phrase naming a group runs from just after "ENIGMA" to the first suffix word or punctuation
SUFFIX = re.compile(
    r"\s*(?:working\s+groups?|\bWGs?\b|consortium|consortia|\bgroups?\b|project|collaboration|"
    r"protocols?|pipelines?|toolbox|viewer|quality|\bQC\b|meta-?analys|mega-?analys|cohorts?|"
    r"samples?|stud(?:y|ies)|sites?|data|initiative|network|template|atlas|[,;.:()\[\]\n])",
    re.I,
)
# group authorship: "for/on behalf of the ENIGMA-OCD Working Group" anywhere outside references, or a
# working-group/consortium name in the front matter (author list)
CREDIT = re.compile(
    r"(?:for|on behalf of) the ENIGMA\b[^.\n]{0,60}?(?:working group|consortium|\bWG\b|workgroup)",
    re.I,
)
FRONT_CREDIT = re.compile(
    r"ENIGMA\b[^.\n]{0,60}?(?:working group|consortium|\bWG\b|workgroup)", re.I
)
SUMSTATS = re.compile(
    r"ENIGMA[^.\n]{0,60}?(?:summary statistics|GWAS|toolbox)|"
    r"(?:summary statistics|GWAS)[^.\n]{0,60}?ENIGMA",
    re.I,
)
PROTOCOL = re.compile(
    r"ENIGMA[^.\n]{0,60}?(?:protocols?|pipelines?|quality control|quality check|\bQC\b|"
    r"guidelines|template|scripts?|tool\b|HALFpipe|cerebellum volumetrics)",
    re.I,
)
# a match next to these is a citation or a grant, not authorship
NOT_CREDIT = re.compile(
    r"CrossRef|Google Scholar|View in Scopus|PubMed|doi\.org|\bdoi:|\(\d{4}\)|\b\d{4};\s?\d+|"
    r"pp\.\s?\d+|Mol\.? Psychiatry|\bet al\b|\bgrants?\b|funded|support(?:ed)? by|Article\s+Open\s+access|"
    r"Poster Session",
    re.I,
)
CREDIT_SECTIONS = {"front", "body", "abstract", "methods", "acknowledgments"}
FIELDS = [
    "paper",
    "pmid",
    "doi",
    "year",
    "title",
    "source",
    "role",
    "credit_group",
    "working_groups",
    "group_phrases",
    "n_mentions",
    "sections",
    "evidence",
]


def group_of(phrase):
    phrase = re.sub(
        r"^(?:['’]s\b|[\s\-‐–]|PGC[\s\-]*|and\s+|&\s*|the\s+)+", "", phrase, flags=re.I
    )
    phrase = re.sub(r"[\s\-]*(?:and|&)?[\s\-]*PGC$", "", phrase, flags=re.I).strip()
    if not phrase:
        return None, ""
    for name, pat in GROUPS:
        if pat.search(phrase):
            return name, phrase
    return None, phrase


def group_at(text, m):
    """(group, phrase) named right after the ENIGMA mention m."""
    if m.group().upper() in ("ENIGMA2", "ENIGMA3"):
        return "Genetics", ""
    after = text[m.end() : m.end() + 100]
    cut = SUFFIX.search(after)
    return group_of(after[: cut.start()] if cut else after[:40])


def meta_title(paper_dir, source):
    return (
        read_json(os.path.join(paper_dir, "processed", source, "metadata.json")).get(
            "title"
        )
        or ""
    )


def search(paper_dir):
    picked = pick_text(paper_dir)
    if picked is None:
        return None
    _, source, path = picked
    with open(path, encoding="utf-8", errors="replace") as f:
        text = f.read()
    mentions = list(MENTION.finditer(text))
    if not mentions:
        return None
    marks = sections(text)
    secs, groups, phrases = Counter(), Counter(), Counter()
    for m in mentions:
        sec = section_at(marks, m.start())
        secs[sec] += 1
        if sec == "references":
            continue
        name, phrase = group_at(text, m)
        if name:
            groups[name] += 1
        elif phrase and len(phrase) <= 40:
            phrases[phrase] += 1

    def first(pattern, allowed, strict=False):
        for m in pattern.finditer(text):
            if section_at(marks, m.start()) not in allowed:
                continue
            if strict and NOT_CREDIT.search(
                text, max(0, m.start() - 60), min(len(text), m.end() + 100)
            ):
                continue
            return m
        return None

    credit_group = ""
    found = first(CREDIT, CREDIT_SECTIONS, strict=True) or (
        first(FRONT_CREDIT, {"front"}, strict=True) if marks[0][1] == "front" else None
    )
    if found:
        role = "working_group"
        named = MENTION.search(text, found.start(), found.end())
        title = meta_title(paper_dir, source)
        in_title = MENTION.search(title)
        # the credit line often says only "ENIGMA consortium"; the title or the most-named group says which one
        credit_group = (
            (group_at(text, named)[0] if named else None)
            or (group_at(title, in_title)[0] if in_title else None)
            or (groups.most_common(1)[0][0] if groups else "consortium")
        )
    elif found := first(
        SUMSTATS, {"methods", "body", "results", "data_availability"}, strict=True
    ):
        role = "summary_stats"
    elif found := first(PROTOCOL, {"methods", "body", "results", "data_availability"}):
        role = "protocol"
    elif set(secs) - {"references"}:
        role = "mentioned"
        found = first(MENTION, set(secs) - {"references"})
    else:
        role = "references_only"
        found = first(MENTION, {"references"})
    evidence = snippet(text, found.start(), found.end()) if found else ""
    ids = read_json(os.path.join(paper_dir, "identifiers.json"))
    meta = read_json(os.path.join(paper_dir, "processed", source, "metadata.json"))
    return {
        "paper": os.path.basename(paper_dir),
        "pmid": ids.get("pmid") or "",
        "doi": ids.get("doi") or "",
        "year": meta.get("publication_year") or "",
        "title": (meta.get("title") or "")[:300],
        "source": source,
        "role": role,
        "credit_group": credit_group,
        "working_groups": ";".join(g for g, _ in groups.most_common()),
        "group_phrases": ";".join(p for p, _ in phrases.most_common(5)),
        "n_mentions": len(mentions),
        "sections": ";".join(f"{s}:{n}" for s, n in secs.most_common()),
        "evidence": evidence,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("roots", nargs="+")
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    dirs = sorted(os.path.join(r, d) for r in args.roots for d in os.listdir(r))
    roles, groups = Counter(), Counter()
    with open(args.out, "w", newline="", encoding="utf-8") as f, Pool(
        args.workers
    ) as pool:
        w = csv.DictWriter(f, fieldnames=FIELDS, delimiter="\t")
        w.writeheader()
        for row in pool.imap_unordered(search, dirs, chunksize=32):
            if row:
                w.writerow(row)
                roles[row["role"]] += 1
                if row["role"] == "working_group":
                    groups[row["credit_group"]] += 1
    print(dict(roles), file=sys.stderr)
    print(groups.most_common(), file=sys.stderr)


if __name__ == "__main__":
    main()
