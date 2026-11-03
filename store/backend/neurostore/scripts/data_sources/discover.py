"""Candidate data sources named in ns-pond full text but missing from the dictionary, for review.

usage: python -I discover.py API_URL OUT.tsv ROOT [ROOT ...] [--workers N] [--min-papers N]

A candidate is a name that follows a usage cue ("data from the", "participants of the", "obtained from")
in the abstract, methods, data availability or acknowledgments, and is either
  - a proper name ending in a source word ("... Study", "... Cohort", "... Consortium"), or
  - a name defined with an acronym whose letters it contains ("Pediatric Imaging ... (PING)").
"""

import argparse
import csv
import os
import re
import sys
from collections import Counter, defaultdict
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from match import (
    build_dictionary,
    key,
    pick_text,
    read_dictionary_rows,
    sections,
    snippet,
)  # noqa: E402

SECTIONS = {"abstract", "methods", "data_availability", "acknowledgments"}
SP = r"[^\S\n]+"  # names never span a line break
CUE = (
    r"(?i:data|dataset|participants?|subjects|individuals|children|adolescents|adults|patients|controls|"
    r"volunteers|images|scans|samples?|cohorts?|recruited|enrolled|obtained|drawn|derived|downloaded|selected|"
    r"taken|collected|acquired|provided|accessed|available|released|part|members?|participat\w*|included)"
)
LINK = r"(?:from|of|in|by|through|via|within|at)"
WORD = r"[A-Z0-9][\w'’\-]*"
TOKEN = rf"(?:{WORD}|of|and|for|the|in|on|&)"
NAME = rf"{WORD}(?:,?{SP}{TOKEN}){{0,8}}"
SOURCE = (
    r"(?i:study|studies|consortium|initiative|cohort|project|biobank|database|dataset|data set|"
    r"repository|archive|registry|sample|collaboration|program|programme|network)"
)
ACR = r"[A-Z][A-Za-z0-9\-]{1,14}"
CANDIDATE = re.compile(
    rf"\b{CUE}\b[^.\n]{{0,40}}?\b{LINK}{SP}(?:the{SP})?(?P<name>{NAME}?)"
    rf"(?:{SP}(?P<source>{SOURCE})\b(?:{SP}?\((?P<acr1>{ACR})\))?|{SP}?\((?P<acr2>{ACR})\))"
)
# "Netherlands Study" + " of Depression and Anxiety (NESDA)": the lazy name stops at the first source word
CONTINUATION = re.compile(
    rf"{SP}(?:of|on|for|in)(?:{SP}the)?{SP}(?P<rest>(?:{TOKEN},?{SP}?){{1,8}}?)\((?P<acr>{ACR})\)"
)
# tools, standards, stimulus sets, rating scales, institutions, general-purpose hosts: named in methods, not sources
NOT_DATA = re.compile(
    r"\b(?:Software|Library|Toolbox|Toolkit|Program|Labell?ing|Mapping|Model|Communications?|Algebra|Atlas|Template|"
    r"Daemon|Pipeline|Package|NeuroImages|Pictures?|Faces?|Words|Lexicon|Psycholinguistic|Naming|Scales?|"
    r"Examination|Assessment|Inventory|Interview|Questionnaire|Battery|Rating|Index|Norms|Stimul\w*|"
    r"University|College|Hospital|Institutes?|Board|Committee|Council|Foundation|Ministry|Agency|Intramural|Clinic|"
    r"School|Department|Laborator(?:y|ies)|Center|Centre|Helsinki|Declaration|Open Science Framework|OSF|GitHub|"
    r"Figshare|Zenodo|Dryad|Mendeley|Dataverse|PubMed|MEDLINE|Embase|Scopus|Web of Science|Cochrane|PsycINFO|"
    r"Analysis|Statistics|Structure|Estimate|Tools?|Likelihood|Component|Contrast|Normalization|Informatics|"
    r"Sounds?|Photo|Objects|Nonword|Facial|Expressions?|Corpus|Test|Quotient|Tomography|Echo Planar|Information|"
    r"Funding|Society|Chair|Subcommittee|Unit|Affairs|Medicine|Permanente|Mechanical Turk|Science-IT|"
    r"Genomes?|Nucleotide|Gene Expression|PubChem|BioResource|Clinical Trials?|Trial Registry|"
    r"IAPS|NimStim|KDEF|FACES?|BOSS|CELEX|SUN|FERET|COLFIS|EsPal|MRC|Theory of Mind|Monetary Incentive|"
    r"Major Depressive Disorder|Mood States)\b"
)
FURNITURE = re.compile(
    r"Journals|Advertising|Career Network|Editorial Board|HOME|Current Issue|Search PMC|TrendMD|"
    r"Google Scholar|CrossRef|View in Scopus|Article Open access|Similar content",
    re.I,
)
STOP = {
    "the",
    "this",
    "that",
    "our",
    "a",
    "an",
    "in",
    "of",
    "for",
    "and",
    "on",
    "&",
    "present",
    "current",
    "previous",
    "each",
    "both",
    "all",
    "these",
    "those",
    "same",
    "other",
    "larger",
    "two",
    "three",
    "four",
    "five",
    "one",
    "first",
    "second",
    "third",
    "pilot",
    "main",
    "original",
    "parent",
}
# a candidate needs at least one capitalized word outside this list
GENERIC = {
    "mri",
    "fmri",
    "pet",
    "eeg",
    "meg",
    "erp",
    "vbm",
    "dti",
    "spect",
    "imaging",
    "neuroimaging",
    "magnetic",
    "resonance",
    "functional",
    "structural",
    "brain",
    "clinical",
    "longitudinal",
    "cross-sectional",
    "behavioral",
    "behavioural",
    "twin",
    "case",
    "control",
    "controls",
    "healthy",
    "patients",
    "participants",
    "subjects",
    "international",
    "national",
    "multicenter",
    "multi-center",
    "multisite",
    "multi-site",
    "large",
    "larger",
    "ongoing",
    "prospective",
    "population-based",
    "community-based",
    "university",
    "hospital",
    "department",
    "center",
    "centre",
    "institute",
    "medical",
    "school",
    "college",
    "research",
    "science",
    "sciences",
    "key",
    "foundation",
    "council",
    "grant",
    "fund",
    "program",
    "programme",
    "project",
    "study",
    "data",
    "table",
    "figure",
    "supplementary",
    "methods",
    "results",
    "abstract",
    "group",
    "groups",
    "sample",
    "network",
    "cohort",
    "database",
    "dataset",
    "consortium",
    "initiative",
    "registry",
    "repository",
    "archive",
    "default",
    "mode",
    "salience",
    "frontoparietal",
    "visual",
    "attention",
    "task",
    "rest",
    "resting",
    "resting-state",
    "open",
    "public",
    "publicly",
    "local",
    "chinese",
    "american",
    "european",
    "german",
    "japanese",
    "korean",
    "dutch",
    "british",
    "french",
    "italian",
    "spanish",
    "swedish",
    "danish",
    "norwegian",
    "finnish",
    "canadian",
    "australian",
    "nih",
    "nimh",
    "nsf",
    "nsfc",
    "eu",
    "usa",
    "us",
    "uk",
    "tms",
    "tdcs",
    "human",
    "studies",
    "pet-ct",
    "pet/ct",
    "fdg-pet",
    "fdg",
    "ct",
    "eeg-fmri",
    "high-density",
    "7t",
    "3t",
    "1.5t",
    "hc",
    "hcs",
    "asd",
    "md",
    "tom",
    "tbss",
    "replication",
    "patient",
    "patients'",
    "multi-partner",
    "supplementary",
    "nki",
}


def initials_fit(name, acr):
    """Schwartz-Hearst: the acronym's letters appear in order in the name, the first at a word start."""
    letters = [c.lower() for c in acr if c.isalnum()]
    words = name.split()
    if not letters or len(words) > len(letters) + 4:
        return False
    starts = [w[0].lower() for w in words]
    if letters[0] not in starts:
        return False
    text, pos = name.lower(), name.lower().index(letters[0])
    for c in letters[1:]:
        pos = text.find(c, pos + 1)
        if pos < 0:
            return False
    return True


def clean(name):
    words = name.replace(",", " ").split()
    while words and words[0].lower() in STOP:
        words = words[1:]
    while words and words[-1].lower() in STOP:
        words = words[:-1]
    return words


def known_variant(words, known_keys, known_acr_keys):
    """'ADNI Database', 'Baltimore Longitudinal Study': a known acronym or the start of a known name."""
    base = key(" ".join(words))
    return (
        base in known_acr_keys
        or base in known_keys
        or (len(base) >= 6 and any(n.startswith(base) for n in known_keys))
    )


def candidates(text, marks, known_keys, known_acronyms, known_acr_keys):
    out = []
    bounds = marks[1:] + [(len(text), None)]
    for (start, sec), (end, _) in zip(marks, bounds):
        if sec not in SECTIONS:
            continue
        for m in CANDIDATE.finditer(text, start, end):
            line_start = text.rfind("\n", 0, m.start()) + 1
            line_end = text.find("\n", m.end())
            if FURNITURE.search(
                text, line_start, line_end if line_end >= 0 else len(text)
            ):
                continue
            words = clean(m.group("name"))
            acr = m.group("acr1") or m.group("acr2") or ""
            if not words or not any(
                w[0].isupper() and w.lower() not in GENERIC for w in words
            ):
                continue
            if m.group("source"):
                source = (
                    m.group("source").title()
                    if m.group("source").islower()
                    else m.group("source")
                )
                name = " ".join(words + [source])
                cont = CONTINUATION.match(text, m.end()) if not acr else None
                if cont:
                    longer = f"{name} {text[m.end():cont.start('rest')].split()[0]} {' '.join(clean(cont.group('rest')))}"
                    if initials_fit(longer, cont.group("acr")):
                        name, acr = longer, cont.group("acr")
            elif initials_fit(" ".join(words), acr):
                name = " ".join(words)
            else:
                continue
            k = key(name)
            if (
                NOT_DATA.search(name)
                or k in known_keys
                or acr in known_acronyms
                or known_variant(words, known_keys, known_acr_keys)
                or any(n in k for n in known_keys if len(n) >= 8)
            ):
                continue
            out.append((k, name, acr, sec, snippet(text, m.start(), m.end())))
    return out


def search(paper_dir):
    picked = pick_text(paper_dir)
    if picked is None:
        return None
    with open(picked[2], encoding="utf-8", errors="replace") as f:
        text = f.read()
    marks = sections(text)
    if marks[0][1] != "front":
        return None
    return os.path.basename(paper_dir), candidates(
        text, marks, KNOWN_KEYS, KNOWN_ACRONYMS, KNOWN_ACR_KEYS
    )


def init(rows):
    global KNOWN_KEYS, KNOWN_ACRONYMS, KNOWN_ACR_KEYS
    entities, names, acronyms, _, _ = build_dictionary(rows)
    KNOWN_KEYS = set(names) | {key(e["name"]) for e in entities.values()}
    KNOWN_ACRONYMS = set(acronyms)
    KNOWN_ACR_KEYS = {key(a) for a in acronyms}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dictionary")
    ap.add_argument("out")
    ap.add_argument("roots", nargs="+")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--min-papers", type=int, default=3)
    args = ap.parse_args()
    dirs = sorted(os.path.join(r, d) for r in args.roots for d in os.listdir(r))
    found = defaultdict(
        lambda: {
            "papers": set(),
            "names": Counter(),
            "acronyms": Counter(),
            "sections": Counter(),
            "example": None,
        }
    )
    with Pool(
        args.workers,
        initializer=init,
        initargs=(read_dictionary_rows(args.dictionary),),
    ) as pool:
        for res in pool.imap_unordered(search, dirs, chunksize=32):
            if not res:
                continue
            paper, cands = res
            for k, name, acr, sec, snip in cands:
                d = found[k]
                if paper not in d["papers"]:
                    d["sections"][sec] += 1
                d["papers"].add(paper)
                d["names"][name] += 1
                if acr:
                    d["acronyms"][acr] += 1
                if d["example"] is None:
                    d["example"] = (paper, snip)
    kept = sorted(
        (d for d in found.values() if len(d["papers"]) >= args.min_papers),
        key=lambda d: -len(d["papers"]),
    )
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow(
            [
                "name",
                "papers",
                "acronyms",
                "sections",
                "example_paper",
                "example_snippet",
            ]
        )
        for d in kept:
            w.writerow(
                [
                    d["names"].most_common(1)[0][0],
                    len(d["papers"]),
                    ";".join(a for a, _ in d["acronyms"].most_common(3)),
                    ";".join(f"{s}:{n}" for s, n in d["sections"].most_common()),
                    *d["example"],
                ]
            )
    print(
        f"{len(found):,} distinct candidates, {len(kept):,} in >= {args.min_papers} papers",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
