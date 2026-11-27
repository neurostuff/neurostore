"""Calibrate the outreach map matcher on NIDM-Results packs from NeuroVault.

A NIDM-Results pack is one analysis exported by SPM, FSL or SnPM: its peak table
and, for each contrast, the t or z map, the contrast (effect) map and the
contrast standard error map the peaks came from. That makes these the one source
of true positive pairs: no name matching, no guessing which map a table used.
The peaks are the software's own, so the statistic maps set a ceiling for
perfectly extracted coordinates; the effect and standard error maps show what
those kinds of upload do with the same coordinates.

Negatives score each pack's maps against the peaks of contrasts from other
collections, skipping any whose peaks largely coincide with the pack's own (the
same open dataset exported twice).

    python calibrate_outreach_matching_nidm.py all --work /path/to/workdir \\
        --nv-dump /path/to/nv-data/february_2024

Needs rdflib to read the packs' Turtle. Not imported by the app; it loads the
matcher by path through calibrate_outreach_matching.
"""

import argparse
import concurrent.futures
import json
import random
import re
import time
from collections import Counter
from pathlib import Path

import numpy as np
import requests

import calibrate_outreach_matching as calibration
from calibrate_outreach_matching import log

NEUROVAULT_MEDIA = "https://neurovault.org/media/"

NIDM = "http://purl.org/nidash/nidm#"
PROV = "http://www.w3.org/ns/prov#"
NFO = "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#"
STATO = "http://purl.obolibrary.org/obo/"
PEAK = NIDM + "NIDM_0000062"
STATISTIC_MAP = NIDM + "NIDM_0000076"
CONTRAST_MAP = NIDM + "NIDM_0000002"
STANDARD_ERROR_MAP = NIDM + "NIDM_0000013"
COORDINATE_VECTOR = NIDM + "NIDM_0000086"
STATISTIC_TYPE = NIDM + "NIDM_0000123"
IN_COORDINATE_SPACE = NIDM + "NIDM_0000104"
IN_WORLD_COORDINATE_SYSTEM = NIDM + "NIDM_0000105"
STATISTIC_TYPES = {
    STATO + "STATO_0000176": "T",
    STATO + "STATO_0000376": "Z",
    STATO + "STATO_0000282": "F",
}
# NIDM's world coordinate systems, folded to what the matcher takes
WORLD_SPACES = {
    "NIDM_0000051": "MNI",  # MNICoordinateSystem
    "NIDM_0000132": "TAL",  # TalairachCoordinateSystem
}
ICBM = re.compile(r"NIDM_00000(4[1-9]|50)$")  # the Icbm*/Mni* template variants

# A pack named for one subject is a first-level analysis, not a group map.
SUBJECT_PACK = re.compile(r"(^|[^a-z])sub(ject)?[-_]?\d", re.IGNORECASE)

# Negatives whose peaks fall this close to this share of a contrast's own peaks
# are the same data exported again, not unrelated coordinates.
SAME_PEAK_MM = 4.0
SAME_PEAKS_SHARE = 1 / 3

KINDS = ("T", "Z", "F", "effect", "standard_error")


def map_path(work, folder, file):
    """Where a pack's map is cached, laid out as the main script lays out images."""
    return calibration.image_path(work, {"url": f"{NEUROVAULT_MEDIA}{folder}/{file}"})


# --------------------------------------------------------------------- fetch


def fetch(args):
    """Every pack's Turtle file, from the dump's list of NIDM-Results."""
    import pandas as pd

    dump = Path(args.nv_dump)
    packs = pd.read_csv(dump / "statmaps_nidmresults.csv", keep_default_na=False, dtype=str)
    items = pd.read_csv(
        dump / "statmaps_basecollectionitem.csv",
        usecols=["id", "collection_id", "name"],
        keep_default_na=False,
        dtype=str,
    )
    packs = packs.merge(items, left_on="basecollectionitem_ptr_id", right_on="id")
    collections = pd.read_csv(
        dump / "statmaps_collection.csv", usecols=["id", "DOI"], keep_default_na=False, dtype=str
    )
    packs = packs.merge(collections, left_on="collection_id", right_on="id", suffixes=("", "_c"))
    session = requests.Session()
    out = args.work / "ttl"
    records = []
    for row in packs.itertuples(index=False):
        path = out / row.ttl_file
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            try:
                response = session.get(NEUROVAULT_MEDIA + row.ttl_file, timeout=60)
                response.raise_for_status()
                path.write_bytes(response.content)
            except requests.RequestException as exc:
                log(f"could not fetch {row.ttl_file}: {exc}")
                continue
        records.append(
            {
                "ttl_file": row.ttl_file,
                "collection": row.collection_id,
                "name": row.name,
                "doi": row.DOI,
            }
        )
    (args.work / "packs.json").write_text(json.dumps(records, indent=1))
    log(f"{len(records)} packs from {len({r['collection'] for r in records})} collections")


# --------------------------------------------------------------------- parse


def _local(uri):
    return str(uri).rsplit("#", 1)[-1].rsplit("/", 1)[-1]


def parse_pack(path):
    """The contrasts in one pack: their peaks, maps and space."""
    import rdflib

    graph = rdflib.Graph()
    graph.parse(path, format="turtle")
    uri = rdflib.URIRef
    rdf_type = rdflib.RDF.type

    def one(subject, predicate):
        return graph.value(subject, uri(predicate))

    def is_a(entity, kind):
        return (entity, rdf_type, uri(kind)) in graph

    def file_name(entity):
        name = one(entity, NFO + "fileName")
        return str(name) if name is not None else None

    def space(entity):
        coordinate_space = one(entity, IN_COORDINATE_SPACE)
        system = one(coordinate_space, IN_WORLD_COORDINATE_SYSTEM) if coordinate_space else None
        if system is None:
            return None
        local = _local(system)
        if local in WORLD_SPACES:
            return WORLD_SPACES[local]
        if ICBM.search(local):
            return "MNI"
        return "OTHER"

    def estimation(statistic_map):
        """The contrast estimation behind a statistic map, through a derived z map too."""
        seen = set()
        while statistic_map is not None and statistic_map not in seen:
            seen.add(statistic_map)
            generated = one(statistic_map, PROV + "wasGeneratedBy")
            if generated is not None and not is_a(generated, NIDM + "NIDM_0000049"):
                return generated
            statistic_map = one(statistic_map, PROV + "wasDerivedFrom")
        return None

    contrasts = {}
    for peak in graph.subjects(rdf_type, uri(PEAK)):
        location = one(peak, PROV + "atLocation")
        vector = one(location, COORDINATE_VECTOR) if location is not None else None
        cluster = one(peak, PROV + "wasDerivedFrom")
        excursion = one(cluster, PROV + "wasDerivedFrom") if cluster is not None else None
        inference = one(excursion, PROV + "wasGeneratedBy") if excursion is not None else None
        if vector is None or inference is None:
            continue
        try:
            coordinates = [float(value) for value in json.loads(str(vector))]
        except (ValueError, TypeError):
            continue
        if len(coordinates) != 3:
            continue
        used = [
            entity
            for entity in graph.objects(inference, uri(PROV + "used"))
            if is_a(entity, STATISTIC_MAP)
        ]
        for statistic_map in used:
            key = estimation(statistic_map) or statistic_map
            entry = contrasts.setdefault(
                key, {"peaks": set(), "inferred_on": file_name(statistic_map), "space": None}
            )
            entry["peaks"].add(tuple(coordinates))
            entry["space"] = entry["space"] or space(excursion) or space(statistic_map)

    packs = []
    for key, entry in contrasts.items():
        maps = []
        generated = list(graph.subjects(uri(PROV + "wasGeneratedBy"), key))
        if is_a(key, STATISTIC_MAP):
            # no estimation recorded: the statistic map is all there is
            generated = [key]
        for entity in generated:
            name = file_name(entity)
            if not name:
                continue
            if is_a(entity, STATISTIC_MAP):
                kind = STATISTIC_TYPES.get(str(one(entity, STATISTIC_TYPE)), "statistic")
            elif is_a(entity, CONTRAST_MAP):
                kind = "effect"
            elif is_a(entity, STANDARD_ERROR_MAP):
                kind = "standard_error"
            else:
                continue
            maps.append({"file": name, "kind": kind})
            # FSL's z map is derived from the t map, not generated by the estimation
            if is_a(entity, STATISTIC_MAP):
                for derived in graph.subjects(uri(PROV + "wasDerivedFrom"), entity):
                    if is_a(derived, STATISTIC_MAP) and file_name(derived):
                        maps.append(
                            {
                                "file": file_name(derived),
                                "kind": STATISTIC_TYPES.get(
                                    str(one(derived, STATISTIC_TYPE)), "statistic"
                                ),
                            }
                        )
        label = one(key, "http://www.w3.org/2000/01/rdf-schema#label") or one(
            key, PROV + "label"
        )
        seen = set()
        unique = [m for m in maps if not (m["file"] in seen or seen.add(m["file"]))]
        packs.append(
            {
                "label": str(label) if label is not None else None,
                "inferred_on": entry["inferred_on"],
                "space": entry["space"],
                "peaks": sorted(entry["peaks"]),
                "maps": unique,
            }
        )
    return packs


def parse(args):
    packs = json.loads((args.work / "packs.json").read_text())
    contrasts = []
    skipped = Counter()

    def one(pack):
        try:
            return pack, parse_pack(args.work / "ttl" / pack["ttl_file"])
        except Exception as exc:  # a malformed pack is skipped, not fatal
            return pack, exc

    # NeuroVault puts a re-upload in the same folder under a new Turtle name; its
    # maps then share file names with the first upload's, so neither can be trusted
    per_folder = Counter(pack["ttl_file"].rsplit("/", 1)[0] for pack in packs)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for pack, parsed in pool.map(one, packs):
            if isinstance(parsed, Exception):
                skipped["unreadable Turtle"] += 1
                continue
            if per_folder[pack["ttl_file"].rsplit("/", 1)[0]] > 1:
                skipped["folder shared with another upload"] += 1
                continue
            pack_name = pack["ttl_file"].split("/")[-2]
            if SUBJECT_PACK.search(pack_name) or SUBJECT_PACK.search(pack["name"] or ""):
                skipped["single-subject pack"] += 1
                continue
            for index, contrast in enumerate(parsed):
                if contrast["space"] not in ("MNI", "TAL"):
                    skipped[f"space {contrast['space']}"] += 1
                    continue
                if len(contrast["peaks"]) < 3:
                    skipped["fewer than 3 peaks"] += 1
                    continue
                contrasts.append(
                    {
                        "id": f"{pack['ttl_file'].rsplit('/', 1)[0]}#{index}",
                        "collection": pack["collection"],
                        "pack": pack_name,
                        "folder": pack["ttl_file"].rsplit("/", 1)[0],
                        **contrast,
                    }
                )
    (args.work / "contrasts.json").write_text(json.dumps(contrasts, indent=1))
    kinds = Counter(m["kind"] for c in contrasts for m in c["maps"])
    log(
        f"{len(contrasts)} contrasts from {len({c['collection'] for c in contrasts})} "
        f"collections; maps {dict(kinds)}; skipped {dict(skipped)}"
    )


# ------------------------------------------------------------------ download


def download(args):
    contrasts = json.loads((args.work / "contrasts.json").read_text())
    session = requests.Session()
    todo = sorted(
        {
            (c["folder"], m["file"])
            for c in contrasts
            for m in c["maps"]
            if m["kind"] in KINDS and not map_path(args.work, c["folder"], m["file"]).exists()
        }
    )
    log(f"{len(todo)} maps to download")

    def one(item):
        folder, file = item
        # the main script's capped, resumable download, into the same layout
        image = {"url": f"{NEUROVAULT_MEDIA}{folder}/{file}"}
        return calibration.download_one(session, args.work, image)

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.download_workers) as pool:
        for count, _ in enumerate(pool.map(one, todo), 1):
            if count % 100 == 0:
                log(f"{count}/{len(todo)} downloaded")


# --------------------------------------------------------------------- score

PAIR_FIELDS = [
    "contrast", "collection", "map_file", "map_kind", "analysis", "own", "outcome", "score",
    "n_points", "signed", "negated", "unsigned", "mirrored", "mirrored_negated",
    "mirrored_unsigned", "peak_signed", "peak_negated", "map_thresholded", "reason",
]


def _overlap(first, second):
    """Share of ``first``'s peaks within SAME_PEAK_MM of one of ``second``'s."""
    a, b = np.asarray(first, float), np.asarray(second, float)
    distances = np.sqrt(((a[:, None, :] - b[None, :, :]) ** 2).sum(axis=2))
    return float((distances.min(axis=1) <= SAME_PEAK_MM).mean())


def score(args):
    import csv

    matching = calibration.load_matching()
    matching.warm_up()
    contrasts = json.loads((args.work / "contrasts.json").read_text())
    for contrast in contrasts:
        contrast["maps"] = [
            m
            for m in contrast["maps"]
            if m["kind"] in KINDS and map_path(args.work, contrast["folder"], m["file"]).exists()
        ]
    contrasts = [c for c in contrasts if c["maps"]]
    rng = random.Random(args.seed)

    negatives = {}
    for contrast in contrasts:
        pool = [
            other
            for other in contrasts
            if other["collection"] != contrast["collection"]
            and _overlap(other["peaks"], contrast["peaks"]) < SAME_PEAKS_SHARE
        ]
        chosen = rng.sample(pool, min(args.negatives, len(pool)))
        negatives[contrast["id"]] = [c["id"] for c in chosen]
    by_id = {c["id"]: c for c in contrasts}
    # every contrast in the same collection, for the assignment test
    siblings = Counter()
    for contrast in contrasts:
        siblings[contrast["collection"]] += 1

    out = open(args.work / "nidm_pairs.csv", "w", newline="")
    writer = csv.DictWriter(out, PAIR_FIELDS)
    writer.writeheader()
    fingerprints = open(args.work / "nidm_fingerprints.jsonl", "w")

    def score_contrast(contrast):
        same_collection = [c for c in contrasts if c["collection"] == contrast["collection"]]
        analyses = {
            c["id"]: {"id": c["id"], "coordinates": c["peaks"], "space": c["space"]}
            for c in [*same_collection, *(by_id[i] for i in negatives[contrast["id"]])]
        }
        prepared = matching.prepare_analyses(list(analyses.values()))
        rows, prints = [], []
        for item in contrast["maps"]:
            path = map_path(args.work, contrast["folder"], item["file"])
            scores = matching.score_map(
                path,
                prepared,
                map_id=f"{contrast['id']}/{item['file']}",
                # standard error maps go in as statistic maps, to show they match nothing
                kind=matching.EFFECT if item["kind"] == "effect" else matching.STATISTIC,
            )
            if scores.fingerprint:
                prints.append(
                    {
                        "contrast": contrast["id"],
                        "collection": contrast["collection"],
                        "map_file": item["file"],
                        "map_kind": item["kind"],
                        "values": scores.fingerprint,
                    }
                )
            for analysis_id, pair in scores.pairs.items():
                readings = pair.readings or {}
                peaks = pair.peak_fraction or {}
                rows.append(
                    {
                        "contrast": contrast["id"],
                        "collection": contrast["collection"],
                        "map_file": item["file"],
                        "map_kind": item["kind"],
                        "analysis": analysis_id,
                        "own": analysis_id == contrast["id"],
                        "outcome": pair.outcome,
                        "score": pair.score,
                        "n_points": pair.n_points,
                        **{key: readings.get(key) for key in PAIR_FIELDS[9:15]},
                        "peak_signed": peaks.get("signed"),
                        "peak_negated": peaks.get("negated"),
                        "map_thresholded": scores.thresholded,
                        "reason": pair.reason,
                    }
                )
        return rows, prints

    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.score_workers) as pool:
        for count, (rows, prints) in enumerate(pool.map(score_contrast, contrasts), 1):
            writer.writerows(rows)
            for row in prints:
                fingerprints.write(json.dumps(row) + "\n")
            if count % 100 == 0:
                log(f"scored {count}/{len(contrasts)} contrasts")
    out.close()
    fingerprints.close()
    (args.work / "nidm_negatives.json").write_text(json.dumps(negatives))
    log(f"scored {len(contrasts)} contrasts in {time.perf_counter() - started:.0f} s")


# -------------------------------------------------------------------- report


def read_pairs(work):
    """The scored pairs, marking each contrast's own peaks and its unrelated ones."""
    import pandas as pd

    pairs = pd.read_csv(work / "nidm_pairs.csv")
    pairs["own"] = pairs["own"].astype(bool)
    negatives = json.loads((work / "nidm_negatives.json").read_text())
    negative_pairs = {
        (contrast, other) for contrast, others in negatives.items() for other in others
    }
    pairs["negative"] = [
        (c, a) in negative_pairs for c, a in zip(pairs["contrast"], pairs["analysis"])
    ]
    return pairs


def report(args):
    import pandas as pd

    matching = calibration.load_matching()
    pairs = read_pairs(args.work)
    contrasts = json.loads((args.work / "contrasts.json").read_text())
    lines = []
    out = lines.append
    software = Counter(re.sub(r"[_\d].*", "", c["pack"]).lower() for c in contrasts)
    out(
        f"contrasts: {pairs['contrast'].nunique()} from {pairs['collection'].nunique()} "
        f"collections; exporters by pack name: {dict(software.most_common(5))}"
    )
    maps = pairs.drop_duplicates(["contrast", "map_file"])
    out(f"maps by kind: {maps['map_kind'].value_counts().to_dict()}")
    out(f"maps read as thresholded: {int((maps['map_thresholded'].astype(str) == 'True').sum())}")
    out("")
    out("own peaks (the true pair) and unrelated peaks, by map kind:")
    for kind in KINDS:
        own = pairs[pairs["own"] & (pairs["map_kind"] == kind)]
        cross = pairs[pairs["negative"] & (pairs["map_kind"] == kind)]
        if own.empty:
            continue
        assessed = own[own["outcome"] != matching.CANNOT_ASSESS]
        counts = assessed["outcome"].value_counts(normalize=True)
        cross_assessed = cross[cross["outcome"] != matching.CANNOT_ASSESS]
        out(
            f"  {kind:15s} n={len(own):4d} (assessed {len(assessed)})  "
            + "  ".join(f"{k}={counts.get(k, 0):.1%}" for k in matching.OUTCOMES[:4])
            + f"  | unrelated: match={(cross_assessed['outcome'] == matching.MATCH).mean():.1%}"
            f" any={cross_assessed['outcome'].isin(matching.ASSIGNABLE).mean():.1%}"
            f" (n={len(cross_assessed)})"
        )
        straight = assessed[["signed", "unsigned"]].max(axis=1)
        quantiles = straight.quantile([0.1, 0.5, 0.9]).round(3).tolist()
        out(
            f"  {'':15s} reading p10/p50/p90 {quantiles}; "
            f"local-peak share {assessed['peak_signed'].mean():.2f}"
        )
    out("")

    # same contrast: effect against statistic
    own = pairs[pairs["own"] & (pairs["outcome"] != matching.CANNOT_ASSESS)]
    wide = own.pivot_table(index="contrast", columns="map_kind", values="outcome", aggfunc="first")
    for statistic in ("T", "Z"):
        if statistic in wide and "effect" in wide:
            both = wide[[statistic, "effect"]].dropna()
            out(f"same contrast, effect map against its {statistic} map (n={len(both)}):")
            out(
                "    "
                + pd.crosstab(both[statistic], both["effect"], margins=True)
                .to_string()
                .replace("\n", "\n    ")
            )
    out("")

    # assignment within a collection: maps of one kind against every contrast of it
    peaks_of = {c["id"]: c["peaks"] for c in contrasts}
    out("suggested assignment within a collection, one kind of map at a time:")
    out(
        "  (a re-export is another pack of the same data, its peaks mostly on this one's; "
        "a negative side is B > A read off an A > B map)"
    )
    for kind in ("T", "Z", "effect", "standard_error"):
        sub = pairs[(pairs["map_kind"] == kind) & ~pairs["negative"]]
        found = Counter()
        total = 0
        for collection, group in sub.groupby("collection"):
            scores = []
            for (contrast, map_file), rows in group.groupby(["contrast", "map_file"]):
                scores.append(
                    matching.MapScores(
                        map_id=f"{contrast}|{map_file}",
                        status=matching.SCORED,
                        pairs={
                            row.analysis: matching.PairScore(
                                map_id=f"{contrast}|{map_file}",
                                analysis_id=row.analysis,
                                outcome=row.outcome,
                                score=None if np.isnan(row.score) else float(row.score),
                            )
                            for row in rows.itertuples(index=False)
                        },
                    )
                )
            assignment = matching.assign(scores, list(group["analysis"].unique()))
            total += len(scores)
            for pair in assignment.pairs:
                own = pair.map_id.split("|")[0]
                if own == pair.analysis_id:
                    found["own contrast"] += 1
                elif _overlap(peaks_of[pair.analysis_id], peaks_of[own]) >= SAME_PEAKS_SHARE:
                    found["re-export"] += 1
                elif pair.side == matching.NEGATIVE:
                    found["another contrast, negative side"] += 1
                else:
                    found["another contrast"] += 1
        if total:
            out(
                f"  {kind:15s} maps={total:4d}  "
                + "  ".join(
                    f"{label} {found[label] / total:.1%}"
                    for label in (
                        "own contrast",
                        "re-export",
                        "another contrast, negative side",
                        "another contrast",
                    )
                )
            )
    out("")

    # effect / statistic pairing by fingerprint, true pairs known
    prints = [json.loads(line) for line in open(args.work / "nidm_fingerprints.jsonl")]
    as_scores = {
        (p["contrast"], p["map_file"]): (
            p,
            matching.MapScores(
                map_id=p["map_file"],
                status=matching.SCORED,
                pairs={},
                fingerprint=tuple(p["values"]),
            ),
        )
        for p in prints
    }
    own_r, other_r = [], []
    by_collection = {}
    for key, (p, scores) in as_scores.items():
        by_collection.setdefault(p["collection"], []).append((p, scores))
    for collection, items in by_collection.items():
        effects = [(p, s) for p, s in items if p["map_kind"] == "effect"]
        statistics = [(p, s) for p, s in items if p["map_kind"] in ("T", "Z")]
        for effect, effect_scores in effects:
            for statistic, statistic_scores in statistics:
                r = matching.fingerprint_correlation(effect_scores, statistic_scores)
                if r is None:
                    continue
                (own_r if effect["contrast"] == statistic["contrast"] else other_r).append(r)
    own_r, other_r = np.array(own_r), np.array(other_r)
    if len(own_r):
        out("effect map against statistic maps of the same collection (fingerprint r):")
        out(
            f"  its own contrast's t/z map: n={len(own_r)}, median {np.median(own_r):.3f}, "
            f">= 0.8 {(own_r >= 0.8).mean():.1%}"
        )
        if len(other_r):
            out(
                f"  another contrast's t/z map: n={len(other_r)}, >= 0.8 "
                f"{(other_r >= 0.8).mean():.1%}, <= -0.8 {(other_r <= -0.8).mean():.1%}"
            )
    text = "\n".join(lines)
    (args.work / "report_nidm.txt").write_text(text)
    print(text)


STEPS = ["fetch", "parse", "download", "score", "report"]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("step", choices=[*STEPS, "all"])
    parser.add_argument("--work", type=Path, required=True, help="working directory")
    parser.add_argument("--nv-dump", help="a NeuroVault dump directory, e.g. february_2024")
    parser.add_argument(
        "--negatives", type=int, default=5, help="unrelated contrasts per contrast"
    )
    parser.add_argument("--download-workers", type=int, default=6)
    parser.add_argument("--score-workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)
    args.work.mkdir(parents=True, exist_ok=True)
    for step in STEPS if args.step == "all" else [args.step]:
        log(f"== {step}")
        globals()[step](args)


if __name__ == "__main__":
    main()
