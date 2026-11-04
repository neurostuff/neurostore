"""Calibrate the outreach map matcher on papers that have both coordinates and maps.

Positive pairs come from neurostore base studies that carry a paper's coordinate
tables and its DOI-linked NeuroVault collection: every map in the collection is
scored against every analysis of its own paper. Negative pairs score the same
maps against the analyses of a few unrelated papers.

Ground truth for which map belongs to which analysis does not exist, and a
collection routinely holds maps the paper never tabled, so a map that matches
nothing is not counted against the matcher. The rates reported are instead:

- per analysis: does its own paper's collection hold a map that fits it, against
  how often an unrelated paper's collection does (the false-match rate the
  author would see as a wrong suggestion);
- per suggested assignment: how many of a paper's analyses get a map from their
  own collection, against how many get one from an unrelated collection;
- for pairs whose names agree (analysis "faces > houses", map "faces_gt_houses"),
  how often the matcher fails or warns on what is very likely a true pair.

Not imported by the app. It loads neurostore/outreach/matching.py by path, so it
runs without the app's environment (no database, no settings):

    python calibrate_outreach_matching.py all --work /path/to/workdir

Each step is resumable and can be run alone: fetch, select, download, score,
report. Downloads are cached under the work directory.
"""

import argparse
import concurrent.futures
import csv
import dataclasses
import importlib.util
import itertools
import json
import random
import re
import sys
import time
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import requests

MATCHING_PATH = (
    Path(__file__).resolve().parents[1] / "backend" / "neurostore" / "outreach" / "matching.py"
)
DEFAULT_API = "https://neurostore.org/api"
PAGE_SIZE = 25

# Map types worth scoring. P maps run the wrong way (small is significant),
# and masks, parcellations and anatomicals are not statistics at all.
SCORABLE_VALUE_TYPES = ("T map", "Z map", "univariate-beta map", "F map", "other")
VALUE_TYPE_PREFERENCE = {value: rank for rank, value in enumerate(SCORABLE_VALUE_TYPES)}

# Which version of a paper's coordinates to use, best first. The pipeline
# extractions are what outreach drafts are built from.
SOURCE_PREFERENCE = ("nuextract-v21", "llm", "pubget", "neurostore", "neurosynth", "ace")

MAX_DOWNLOAD_BYTES = 80 * 1024 * 1024

# What a map holds, going by its file name before NeuroVault's map type: SPM's
# beta_0001 and con_0001 are often uploaded as "T map". A statistic token wins,
# since FSL's cope2_zstat1 is a z map.
STATISTIC = "statistic"
EFFECT = "effect"
AMBIGUOUS = "ambiguous"
STATISTIC_NAME = re.compile(
    r"zstat|tstat|spm[tzf]|stat-[tzf](?![a-z])|z[_-]?score|(^|[^a-z])[tz][_-]?(map|stat)|"
    r"_[tzf]\.nii",
    re.IGNORECASE,
)
EFFECT_NAME = re.compile(
    r"effect[_-]?size|stat-effect|effects?map|cope\d|(^|[^a-z])con_?\d{2,4}|"
    r"(^|[^a-z])betas?([_-]?\d|\.nii)|(^|[_-])pe\d",
    re.IGNORECASE,
)
# Tokens that say what kind of map a file is, not which contrast; what is left
# names the contrast, so cope3 and zstat3 (or con_0003 and spmT_0003) agree.
KIND_TOKENS = {
    "cope", "varcope", "zstat", "tstat", "fstat", "spmt", "spmz", "spmf", "con", "beta",
    "betas", "effect", "effects", "effectsmap", "size", "stat", "statmap", "z", "t", "f",
    "score", "map", "pe", "nii", "gz", "img", "unthresh", "unthresholded",
}

# Words that say nothing about which contrast a name describes.
NAME_STOPWORDS = {
    "a", "an", "and", "the", "of", "in", "on", "for", "with", "vs", "versus", "v",
    "gt", "lt", "minus", "map", "maps", "stat", "zstat", "tstat", "spmt", "spmz",
    "spmf", "con", "cope", "beta", "contrast", "group", "level", "effect",
    "effects", "main", "analysis", "nii", "gz", "img", "hdr", "thresh",
    "unthresholded", "thresholded", "z", "t", "f", "fwe", "fdr", "unc", "p",
    "all", "participants", "subjects", "mean", "table", "results",
}


def map_kind(image):
    """STATISTIC, EFFECT or AMBIGUOUS for a NeuroVault image record."""
    filename = image.get("filename") or ""
    if STATISTIC_NAME.search(filename):
        return STATISTIC
    if image.get("value_type") == "univariate-beta map" or EFFECT_NAME.search(filename):
        return EFFECT
    if image.get("value_type") in ("T map", "Z map", "F map"):
        return STATISTIC
    return AMBIGUOUS


# Which statistic a statistic map holds, again going by its file name before
# NeuroVault's map type: an FSL zstat uploaded as "T map" is a z map.
STATISTIC_TYPE_NAMES = {
    "z": re.compile(
        r"zstat|spmz|stat-z(?![a-z])|z[_-]?score|(^|[^a-z])z[_-]?(map|stat)|_z\.nii", re.I
    ),
    "t": re.compile(r"tstat|spmt|stat-t(?![a-z])|(^|[^a-z])t[_-]?(map|stat)|_t\.nii", re.I),
    "F": re.compile(r"fstat|spmf|stat-f(?![a-z])|(^|[^a-z])f[_-]?(map|stat)|_f\.nii", re.I),
}
STATISTIC_VALUE_TYPES = {"T map": "t", "Z map": "z", "F map": "F"}


def statistic_type(image):
    """t, z or F for a statistic map; None when neither its name nor its type says."""
    filename = image.get("filename") or ""
    for statistic, pattern in STATISTIC_TYPE_NAMES.items():
        if pattern.search(filename):
            return statistic
    return STATISTIC_VALUE_TYPES.get(image.get("value_type"))


def statistic_types(papers):
    """(paper, map key) -> t, z or F, for every statistic map in papers.json."""
    return {
        (paper["base_study"], image["key"]): statistic_type(image)
        for paper in papers
        for image in paper["images"]
        if image["kind"] == STATISTIC
    }


def contrast_key(text):
    """The words and numbers of a file or map name that name its contrast."""
    stem = re.sub(r"\.(nii|img|hdr)(\.gz)?$", "", (text or "").lower())
    tokens = re.split(r"[^a-z0-9]+|(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])", stem)
    return tuple(
        str(int(token)) if token.isdigit() else token
        for token in tokens
        if token and token not in KIND_TOKENS
    )


def load_matching():
    spec = importlib.util.spec_from_file_location("outreach_matching", MATCHING_PATH)
    module = importlib.util.module_from_spec(spec)
    # dataclasses look the module up while the class bodies run
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def log(message):
    print(f"[{time.strftime('%H:%M:%S')}] {message}", flush=True)


def get_json(session, url, params=None, retries=4):
    for attempt in range(retries):
        try:
            response = session.get(url, params=params, timeout=120)
            if response.status_code == 429 or response.status_code >= 500:
                raise requests.HTTPError(f"{response.status_code} from {url}")
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError):
            if attempt == retries - 1:
                raise
            time.sleep(2 * 2**attempt)
    return None


# --------------------------------------------------------------------- fetch


def fetch(args):
    """Every base study with images, nested down to points and images."""
    api_dir = args.work / "api"
    api_dir.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    url = f"{args.api}/base-studies/"
    params = {"data_type": "image", "nested": "true", "page_size": PAGE_SIZE}

    first = get_json(session, url, {**params, "page": 1})
    total = first["metadata"]["total_count"]
    pages = (total + PAGE_SIZE - 1) // PAGE_SIZE
    log(f"{total} base studies with images over {pages} pages")
    (api_dir / "page_0001.json").write_text(json.dumps(first))
    for page in range(2, pages + 1):
        path = api_dir / f"page_{page:04d}.json"
        if path.exists():
            continue
        payload = get_json(session, url, {**params, "page": page})
        path.write_text(json.dumps(payload))
        log(f"page {page}/{pages}")


def iter_base_studies(work):
    for path in sorted((work / "api").glob("page_*.json")):
        yield from json.loads(path.read_text())["results"]


# -------------------------------------------------------------------- select


def nv_metadata(dump_dir):
    """NeuroVault's own flags for each image file, keyed by its media path."""
    if not dump_dir:
        return {}
    import pandas as pd

    dump_dir = Path(dump_dir)
    # keep_default_na: "None" is a real cognitive atlas id in these dumps
    image = pd.read_csv(
        dump_dir / "statmaps_image.csv",
        usecols=["file", "basecollectionitem_ptr_id"],
        keep_default_na=False,
        dtype=str,
    )
    statmap = pd.read_csv(
        dump_dir / "statmaps_statisticmap.csv",
        usecols=[
            "image_ptr_id", "map_type", "modality", "is_thresholded", "not_mni",
            "analysis_level", "contrast_definition", "brain_coverage",
        ],
        keep_default_na=False,
        dtype=str,
    )
    merged = image.merge(
        statmap, left_on="basecollectionitem_ptr_id", right_on="image_ptr_id"
    )
    return {
        row["file"]: {
            "nv_image_id": row["image_ptr_id"],
            "nv_map_type": row["map_type"],
            "modality": row["modality"],
            "is_thresholded": row["is_thresholded"] == "t",
            "not_mni": row["not_mni"] == "t",
            "analysis_level": row["analysis_level"],
            "contrast_definition": row["contrast_definition"],
        }
        for row in merged.to_dict("records")
    }


def media_path(url):
    """images/<collection>/<file> from a NeuroVault media url."""
    path = urlparse(url).path
    marker = "/media/"
    return path.split(marker, 1)[1] if marker in path else path.lstrip("/")


def analysis_space(points):
    spaces = Counter(
        (point.get("space") or "").strip().upper() or None for point in points
    )
    space, _ = spaces.most_common(1)[0]
    return space


def pick_coordinate_version(versions):
    """The version whose coordinates the outreach draft would be built from."""
    candidates = []
    for version in versions:
        if version.get("source") == "neurovault":
            continue
        analyses = [
            analysis
            for analysis in version.get("analyses") or []
            if len(analysis.get("points") or []) >= 3
        ]
        if not analyses:
            continue
        source = version.get("source") or ""
        rank = (
            SOURCE_PREFERENCE.index(source)
            if source in SOURCE_PREFERENCE
            else len(SOURCE_PREFERENCE)
        )
        candidates.append((rank, -len(analyses), version["id"], version, analyses))
    if not candidates:
        return None, []
    candidates.sort(key=lambda item: item[:3])
    _, _, _, version, analyses = candidates[0]
    return version, analyses


def select(args):
    """Papers with scorable maps and analyses of 3+ coordinates, sampled."""
    metadata = nv_metadata(args.nv_dump)
    papers = []
    skipped = Counter()
    for base in iter_base_studies(args.work):
        if not (base.get("has_coordinates") and base.get("has_images")):
            skipped["no coordinates"] += 1
            continue
        versions = [v for v in base.get("versions") or [] if isinstance(v, dict)]
        version, analyses = pick_coordinate_version(versions)
        if version is None:
            skipped["no analysis with 3+ coordinates"] += 1
            continue

        images = []
        seen_urls = set()
        for nv_version in versions:
            if nv_version.get("source") != "neurovault":
                continue
            for nv_analysis in nv_version.get("analyses") or []:
                for image in nv_analysis.get("images") or []:
                    url = image.get("url")
                    if not url or url in seen_urls:
                        continue
                    if image.get("value_type") not in SCORABLE_VALUE_TYPES:
                        continue
                    meta = metadata.get(media_path(url), {})
                    # NeuroVault's own flags, where the dump knows the image
                    if meta.get("not_mni") or meta.get("analysis_level") == "S":
                        continue
                    if meta.get("modality") and meta["modality"] != "fMRI-BOLD":
                        continue
                    seen_urls.add(url)
                    images.append(
                        {
                            "key": image["id"],
                            "url": url,
                            "name": nv_analysis.get("name") or image.get("analysis_name"),
                            "filename": image.get("filename"),
                            "value_type": image.get("value_type"),
                            "kind": map_kind(image),
                            "collection": nv_version.get("source_id"),
                            **meta,
                        }
                    )
        if not images:
            skipped["no scorable map"] += 1
            continue

        images.sort(key=lambda image: (VALUE_TYPE_PREFERENCE[image["value_type"]], image["url"]))
        papers.append(
            {
                "base_study": base["id"],
                "doi": base.get("doi"),
                "pmid": base.get("pmid"),
                "year": base.get("year"),
                "coordinate_version": version["id"],
                "coordinate_source": version.get("source"),
                "analyses": [
                    {
                        "id": analysis["id"],
                        "name": analysis.get("name"),
                        "space": analysis_space(analysis["points"]),
                        "coordinates": [point["coordinates"] for point in analysis["points"]],
                        # reported statistics below zero, where the table gave one
                        "n_negative_values": sum(
                            1
                            for point in analysis["points"]
                            for value in point.get("values") or []
                            if isinstance(value.get("value"), (int, float))
                            and value["value"] < 0
                        ),
                    }
                    for analysis in analyses
                ],
                "images": images,
                "n_images_total": len(images),
            }
        )

    rng = random.Random(args.seed)
    rng.shuffle(papers)
    papers = papers[: args.max_papers]
    for paper in papers:
        # effect maps get their own quota, or the statistic maps would crowd them out
        effect = [image for image in paper["images"] if image["kind"] == EFFECT]
        other = [image for image in paper["images"] if image["kind"] != EFFECT]
        paper["images"] = other[: args.max_maps] + effect[: args.max_effect_maps]
    (args.work / "papers.json").write_text(json.dumps(papers, indent=1))
    log(
        f"selected {len(papers)} papers, {sum(len(p['images']) for p in papers)} maps, "
        f"{sum(len(p['analyses']) for p in papers)} analyses; skipped {dict(skipped)}"
    )


# ------------------------------------------------------------------ download


def image_path(work, image):
    return work / "images" / media_path(image["url"])


def download_one(session, work, image):
    path = image_path(work, image)
    if path.exists():
        return path.stat().st_size
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(path.name + ".part")
    size = 0
    try:
        with session.get(image["url"], stream=True, timeout=120) as response:
            response.raise_for_status()
            with open(partial, "wb") as out:
                for chunk in response.iter_content(chunk_size=1 << 20):
                    size += len(chunk)
                    if size > MAX_DOWNLOAD_BYTES:
                        raise ValueError("over the download limit")
                    out.write(chunk)
        partial.rename(path)
        return size
    except Exception as exc:
        partial.unlink(missing_ok=True)
        (path.with_name(path.name + ".failed")).write_text(str(exc))
        return 0


def download(args):
    papers = json.loads((args.work / "papers.json").read_text())
    session = requests.Session()
    budget = int(args.max_total_gb * 1024**3)
    todo = [
        image
        for paper in papers
        for image in paper["images"]
        if not image_path(args.work, image).exists()
        and not image_path(args.work, image).with_name(
            image_path(args.work, image).name + ".failed"
        ).exists()
    ]
    log(f"{len(todo)} maps to download")
    used = sum(
        image_path(args.work, image).stat().st_size
        for paper in papers
        for image in paper["images"]
        if image_path(args.work, image).exists()
    )
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.download_workers) as pool:
        futures = {}
        for image in todo:
            futures[pool.submit(download_one, session, args.work, image)] = image
        for count, future in enumerate(concurrent.futures.as_completed(futures), 1):
            used += future.result()
            if count % 50 == 0:
                log(f"{count}/{len(todo)} downloaded, {used / 1024**3:.2f} GB")
            if used > budget:
                log("download budget reached; stopping")
                for pending in futures:
                    pending.cancel()
                break


# --------------------------------------------------------------------- score

PAIR_FIELDS = [
    "paper", "map_key", "map_value_type", "map_kind", "map_thresholded", "analysis_paper",
    "analysis_id", "own", "name_similarity", "direction", "n_negative_values", "outcome",
    "score",
    "n_points", "n_outside", "signed", "negated", "unsigned", "mirrored",
    "mirrored_negated", "mirrored_unsigned", "peak_signed", "peak_negated", "reason",
]
MAP_FIELDS = [
    "paper", "map_key", "value_type", "kind", "nv_thresholded", "read_thresholded", "status",
    "reason", "seconds", "voxel_size", "n_analyses_scored", "n_points_scored", "bytes",
]
RELATED_FIELDS = ["paper", "map_a", "map_b", "kind", "correlation"]


def name_tokens(text):
    words = re.split(r"[^a-z0-9]+", (text or "").lower())
    return {
        word
        for word in words
        if len(word) > 1 and word not in NAME_STOPWORDS and not word.isdigit()
    }


# How a contrast name says which side is subtracted from which. The first
# comparator splits the name; "<" and "less than" put the larger side second.
COMPARATOR = re.compile(
    r"(>|<|\bvs\.?(?=\s|$)|\bversus\b|\bminus\b|\bgreater(?: than)?\b|\bless than\b|"
    r"\bgt\b|\blt\b)",
    re.IGNORECASE,
)


def contrast_sides(text):
    """(larger side tokens, smaller side tokens) of a contrast name, or None."""
    text = (text or "").replace("_", " ")
    found = COMPARATOR.search(text)
    if found is None:
        return None
    left, right = name_tokens(text[: found.start()]), name_tokens(text[found.end():])
    if not left or not right:
        return None
    if found.group(0).strip().lower() in ("<", "lt", "less than"):
        left, right = right, left
    return left, right


def contrast_direction(analysis, image):
    """Whether a pair's names state the same contrast, the reverse, or neither."""
    mine = contrast_sides(analysis.get("name"))
    theirs = None
    for text in (image.get("name"), image.get("contrast_definition"), image.get("filename")):
        theirs = contrast_sides(text)
        if theirs is not None:
            break
    if mine is None or theirs is None:
        return "undirected"
    same = len(mine[0] & theirs[0]) + len(mine[1] & theirs[1])
    opposite = len(mine[0] & theirs[1]) + len(mine[1] & theirs[0])
    if opposite > same:
        return "reversed"
    if same > opposite:
        return "straight"
    return "unclear"


def name_similarity(analysis, image):
    left = name_tokens(analysis.get("name"))
    right = name_tokens(
        " ".join(
            filter(
                None,
                [
                    image.get("name"),
                    re.sub(r"\.nii(\.gz)?$", "", image.get("filename") or ""),
                    image.get("contrast_definition"),
                ],
            )
        )
    )
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def score(args):
    matching = load_matching()
    started = time.perf_counter()
    matching.warm_up()
    log(f"warm-up {time.perf_counter() - started:.1f} s")

    papers = json.loads((args.work / "papers.json").read_text())
    for paper in papers:
        paper["images"] = [
            image for image in paper["images"] if image_path(args.work, image).exists()
        ]
    papers = [paper for paper in papers if paper["images"]]
    by_id = {paper["base_study"]: paper for paper in papers}
    rng = random.Random(args.seed)

    pairs_out = open(args.work / "pairs.csv", "w", newline="")
    maps_out = open(args.work / "maps.csv", "w", newline="")
    related_out = open(args.work / "related.csv", "w", newline="")
    fingerprints_out = open(args.work / "fingerprints.jsonl", "w")
    pair_writer = csv.DictWriter(pairs_out, PAIR_FIELDS)
    map_writer = csv.DictWriter(maps_out, MAP_FIELDS)
    related_writer = csv.DictWriter(related_out, RELATED_FIELDS)
    pair_writer.writeheader()
    map_writer.writeheader()
    related_writer.writeheader()

    negatives_of = {}
    for paper in papers:
        others = [pid for pid in by_id if pid != paper["base_study"]]
        negatives_of[paper["base_study"]] = rng.sample(others, min(args.negatives, len(others)))
    (args.work / "negatives.json").write_text(json.dumps(negatives_of, indent=1))

    def score_paper(paper):
        owners = [paper["base_study"], *negatives_of[paper["base_study"]]]
        analyses = []
        info = {}
        for owner in owners:
            for analysis in by_id[owner]["analyses"]:
                key = f"{owner}::{analysis['id']}"
                analyses.append(
                    {"id": key, "coordinates": analysis["coordinates"], "space": analysis["space"]}
                )
                info[key] = (owner, analysis)
        prepared = matching.prepare_analyses(analyses)
        rows, map_rows, all_scores = [], [], []
        for image in paper["images"]:
            path = image_path(args.work, image)
            scores = matching.score_map(
                path,
                prepared,
                map_id=image["key"],
                kind=matching.EFFECT if image["kind"] == EFFECT else matching.STATISTIC,
            )
            all_scores.append(scores)
            scored = [p for p in scores.pairs.values() if p.outcome != matching.CANNOT_ASSESS]
            map_rows.append(
                {
                    "paper": paper["base_study"],
                    "map_key": image["key"],
                    "value_type": image["value_type"],
                    "kind": image["kind"],
                    "nv_thresholded": image.get("is_thresholded"),
                    "read_thresholded": scores.thresholded,
                    "status": scores.status,
                    "reason": scores.reason,
                    "seconds": scores.seconds,
                    "voxel_size": (
                        "x".join(f"{size:g}" for size in scores.voxel_size_mm)
                        if scores.voxel_size_mm
                        else ""
                    ),
                    "n_analyses_scored": len(scored),
                    "n_points_scored": sum(p.n_points for p in scored),
                    "bytes": path.stat().st_size,
                }
            )
            for key, pair in scores.pairs.items():
                owner, analysis = info[key]
                readings = pair.readings or {}
                peaks = pair.peak_fraction or {}
                rows.append(
                    {
                        "paper": paper["base_study"],
                        "map_key": image["key"],
                        "map_value_type": image["value_type"],
                        "map_kind": image["kind"],
                        "map_thresholded": image.get("is_thresholded"),
                        "analysis_paper": owner,
                        "analysis_id": analysis["id"],
                        "own": owner == paper["base_study"],
                        "name_similarity": (
                            round(name_similarity(analysis, image), 3)
                            if owner == paper["base_study"]
                            else ""
                        ),
                        "direction": (
                            contrast_direction(analysis, image)
                            if owner == paper["base_study"]
                            else ""
                        ),
                        "n_negative_values": analysis["n_negative_values"],
                        "outcome": pair.outcome,
                        "score": pair.score,
                        "n_points": pair.n_points,
                        "n_outside": pair.n_outside,
                        "signed": readings.get("signed"),
                        "negated": readings.get("negated"),
                        "unsigned": readings.get("unsigned"),
                        "mirrored": readings.get("mirrored"),
                        "mirrored_negated": readings.get("mirrored_negated"),
                        "mirrored_unsigned": readings.get("mirrored_unsigned"),
                        "peak_signed": peaks.get("signed"),
                        "peak_negated": peaks.get("negated"),
                        "reason": pair.reason,
                    }
                )
        related = [
            {
                "paper": paper["base_study"],
                "map_a": found.map_ids[0],
                "map_b": found.map_ids[1],
                "kind": found.kind,
                "correlation": found.correlation,
            }
            for found in matching.related_maps(all_scores)
        ]
        fingerprints = [
            {"paper": paper["base_study"], "map_key": scores.map_id, "values": scores.fingerprint}
            for scores in all_scores
            if scores.fingerprint
        ]
        return rows, map_rows, related, fingerprints

    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.score_workers) as pool:
        for rows, map_rows, related, fingerprints in pool.map(score_paper, papers):
            pair_writer.writerows(rows)
            map_writer.writerows(map_rows)
            related_writer.writerows(related)
            for fingerprint in fingerprints:
                fingerprints_out.write(json.dumps(fingerprint) + "\n")
            done += 1
            if done % 20 == 0:
                log(f"scored {done}/{len(papers)} papers")
    pairs_out.close()
    maps_out.close()
    related_out.close()
    fingerprints_out.close()
    log(f"scored {len(papers)} papers in {time.perf_counter() - started:.0f} s")


# -------------------------------------------------------------------- report


def read_rows(work):
    import pandas as pd

    pairs = pd.read_csv(work / "pairs.csv", keep_default_na=True)
    maps = pd.read_csv(work / "maps.csv", keep_default_na=True)
    return pairs, maps


def unthresholded(maps):
    """Maps neither NeuroVault nor the matcher calls thresholded; outreach asks for these."""
    return maps[
        (maps["nv_thresholded"].astype(str) != "True")
        & (maps["read_thresholded"].astype(str) == "False")
    ]


def redecide(matching, pairs, thresholds, mixed=True):
    """Outcomes and scores under other thresholds, from the stored readings.

    ``mixed=False`` drops the unsigned reading, to see what accepting tables that
    mix increases and decreases costs in false matches.
    """
    keys = ["signed", "negated", "unsigned", "mirrored", "mirrored_negated", "mirrored_unsigned"]
    outcomes, scores = [], []
    for row in pairs.itertuples(index=False):
        if row.outcome == matching.CANNOT_ASSESS:
            outcomes.append(matching.CANNOT_ASSESS)
            scores.append(np.nan)
            continue
        readings = {
            key: (None if np.isnan(getattr(row, key)) else float(getattr(row, key)))
            for key in keys
        }
        if not mixed:
            readings["unsigned"] = readings["signed"]
            readings["mirrored_unsigned"] = readings["mirrored"]
        kind = matching.EFFECT if row.map_kind == EFFECT else matching.STATISTIC
        outcome, value = matching._decide(readings, thresholds.for_kind(kind))
        outcomes.append(outcome)
        scores.append(value)
    out = pairs.copy()
    out["outcome"] = outcomes
    out["score"] = scores
    return out


def assignment_counts(matching, pairs, both_sides=True):
    """Analyses given a map by the suggested assignment, own and unrelated."""
    own_assigned = own_total = 0
    foreign_assigned = foreign_total = 0
    own_pairs = set()
    for paper, group in pairs.groupby("paper"):
        for analysis_paper, sub in group.groupby("analysis_paper"):
            scores = []
            for map_key, rows in sub.groupby("map_key"):
                scores.append(
                    matching.MapScores(
                        map_id=str(map_key),
                        status=matching.SCORED,
                        pairs={
                            str(row.analysis_id): matching.PairScore(
                                map_id=str(map_key),
                                analysis_id=str(row.analysis_id),
                                outcome=row.outcome,
                                score=None if np.isnan(row.score) else float(row.score),
                            )
                            for row in rows.itertuples(index=False)
                        },
                    )
                )
            analysis_ids = [str(a) for a in sub["analysis_id"].unique()]
            assignment = matching.assign(scores, analysis_ids, both_sides=both_sides)
            assessable = sub.groupby("analysis_id")["outcome"].apply(
                lambda o: (o != matching.CANNOT_ASSESS).any()
            )
            n_assessable = int(assessable.sum())
            if analysis_paper == paper:
                own_assigned += len(assignment.pairs)
                own_total += n_assessable
                own_pairs.update((paper, pair.analysis_id) for pair in assignment.pairs)
            else:
                foreign_assigned += len(assignment.pairs)
                foreign_total += n_assessable
    return {
        "own_assigned": own_assigned,
        "own_total": own_total,
        "foreign_assigned": foreign_assigned,
        "foreign_total": foreign_total,
        "own_pairs": own_pairs,
    }


def reverse_analysis_pairs(papers):
    """Analysis pairs a paper tables as A > B and B > A, going by their names."""
    found = []
    for paper in papers:
        for first, second in itertools.combinations(paper["analyses"], 2):
            mine, theirs = contrast_sides(first["name"]), contrast_sides(second["name"])
            if mine is None or theirs is None:
                continue
            words, other_words = mine[0] | mine[1], theirs[0] | theirs[1]
            # the same words on both sides, or "high > low loss" would pair
            # with "low > high gain"
            if len(words & other_words) < 0.75 * len(words | other_words):
                continue
            same = len(mine[0] & theirs[0]) + len(mine[1] & theirs[1])
            opposite = len(mine[0] & theirs[1]) + len(mine[1] & theirs[0])
            if opposite > same and mine[0] & theirs[1] and mine[1] & theirs[0]:
                found.append((paper["base_study"], str(first["id"]), str(second["id"])))
    return found


def reverse_coverage(matching, pairs, reverse_pairs, related):
    """How each paper's collection covers its A > B / B > A analysis pairs."""
    own = pairs[pairs["own"]]
    outcome = {
        (row.paper, row.map_key, str(row.analysis_id)): row.outcome
        for row in own.itertuples(index=False)
    }
    maps_of = own.groupby("paper")["map_key"].unique().to_dict()
    inverse = {
        (row.paper, frozenset((row.map_a, row.map_b)))
        for row in related.itertuples(index=False)
        if row.kind == matching.INVERSE
    }
    found = Counter()
    for paper, first, second in reverse_pairs:
        maps = maps_of.get(paper, [])
        fits = {m: (outcome.get((paper, m, first)), outcome.get((paper, m, second))) for m in maps}
        firsts = [m for m, (a, _) in fits.items() if a == matching.MATCH]
        seconds = [m for m, (_, b) in fits.items() if b == matching.MATCH]
        two = [(a, b) for a in firsts for b in seconds if a != b]
        if two:
            copies = any((paper, frozenset(pair)) in inverse for pair in two)
            found["two maps, one per side" + (", inverse copies" if copies else "")] += 1
        elif any({a, b} == {matching.MATCH, matching.REVERSED_SIGN} for a, b in fits.values()):
            found["one map, both sides"] += 1
        elif any(
            value in matching.ASSIGNABLE for both in fits.values() for value in both
        ):
            found["one side only"] += 1
        else:
            found["neither"] += 1
    return found


def analysis_level(matching, pairs):
    """Best outcome per (analysis, collection): own collection and unrelated ones."""
    rank = {
        matching.MATCH: 0,
        matching.REVERSED_SIGN: 1,
        matching.LR_FLIP: 2,
        matching.NO_MATCH: 3,
        matching.CANNOT_ASSESS: 4,
    }
    scored = pairs[pairs["outcome"] != matching.CANNOT_ASSESS].copy()
    scored["rank"] = scored["outcome"].map(rank)
    best = scored.sort_values("rank").groupby(["paper", "analysis_paper", "analysis_id"]).head(1)
    own = best[best["own"]]
    foreign = best[~best["own"]]
    return own, foreign


def rate(numerator, denominator):
    return f"{numerator / denominator:.1%}" if denominator else "n/a"


def kind_summary(matching, pairs):
    """Per-analysis and assignment rates, counting only one kind of map at a time."""
    kinds_by_paper = pairs.groupby("paper")["map_kind"].agg(set)
    both = set(kinds_by_paper[kinds_by_paper.apply(lambda k: {EFFECT, STATISTIC} <= k)].index)
    rows = []
    scopes = [("all papers", pairs), ("papers with both", pairs[pairs["paper"].isin(both)])]
    for scope, scoped in scopes:
        for kind in (STATISTIC, EFFECT, AMBIGUOUS):
            sub = scoped[scoped["map_kind"] == kind]
            if sub.empty:
                continue
            own_best, foreign_best = analysis_level(matching, sub)
            counts = assignment_counts(matching, sub)
            rows.append(
                {
                    "kind": kind,
                    "papers": scope,
                    "maps": sub.drop_duplicates(["paper", "map_key"]).shape[0],
                    "n papers": sub["paper"].nunique(),
                    "own analyses": len(own_best),
                    "own coll. match": (own_best["outcome"] == matching.MATCH).mean(),
                    "unrel. coll. match": (foreign_best["outcome"] == matching.MATCH).mean(),
                    "unrel. n": len(foreign_best),
                    "assigned own": counts["own_assigned"] / max(counts["own_total"], 1),
                    "assigned unrel.": (
                        counts["foreign_assigned"] / max(counts["foreign_total"], 1)
                    ),
                }
            )
    return rows


def cluster_interval(matched, clusters, n_boot=4000, seed=0):
    """95% interval for a match rate, resampling whole clusters (papers, collections).

    One paper's analyses share its tables and its maps, so they don't count as
    independent; resampling papers keeps the interval honest about that.
    """
    import pandas as pd

    per = pd.DataFrame({"matched": matched, "cluster": clusters}).groupby("cluster")["matched"]
    sums, counts = per.sum().to_numpy(), per.count().to_numpy()
    picks = np.random.default_rng(seed).integers(0, len(sums), size=(n_boot, len(sums)))
    rates = sums[picks].sum(axis=1) / counts[picks].sum(axis=1)
    return tuple(np.percentile(rates, [2.5, 97.5]))


def statistic_type_summary(matching, pairs, types):
    """The per-analysis rates for t, z and F maps apart, with intervals over papers."""
    pairs = pairs.assign(
        statistic=[types.get(key) for key in zip(pairs["paper"], pairs["map_key"])]
    )
    rows = []
    for statistic in ("t", "z", "F"):
        sub = pairs[pairs["statistic"] == statistic]
        if sub.empty:
            continue
        own_best, foreign_best = analysis_level(matching, sub)
        own_matched = own_best["outcome"] == matching.MATCH
        foreign_matched = foreign_best["outcome"] == matching.MATCH
        cross = sub[~sub["own"] & (sub["outcome"] != matching.CANNOT_ASSESS)]
        counts = assignment_counts(matching, sub)
        maps = sub.drop_duplicates(["paper", "map_key"])
        rows.append(
            {
                "type": statistic,
                "n papers": sub["paper"].nunique(),
                "maps": len(maps),
                "maps per paper": len(maps) / maps["paper"].nunique(),
                "own analyses": len(own_best),
                "own coll. match": own_matched.mean(),
                "own 95%": cluster_interval(own_matched, own_best["paper"]),
                "unrel. n": len(foreign_best),
                "unrel. coll. match": foreign_matched.mean(),
                "unrel. 95%": cluster_interval(foreign_matched, foreign_best["paper"]),
                "unrel. pair match": (cross["outcome"] == matching.MATCH).mean(),
                "assigned own": counts["own_assigned"] / max(counts["own_total"], 1),
                "assigned unrel.": counts["foreign_assigned"] / max(counts["foreign_total"], 1),
            }
        )
    return rows


def effect_statistic_pairs(matching, papers, fingerprints, keep):
    """Each effect map's statistic map, found by name and by correlation."""
    rows = []
    for paper in papers:
        pid = paper["base_study"]
        images = [image for image in paper["images"] if (pid, image["key"]) in keep]
        effects = [image for image in images if image["kind"] == EFFECT]
        statistics = [image for image in images if image["kind"] == STATISTIC]
        if not effects or not statistics:
            continue
        for effect in effects:
            by_file = [
                s for s in statistics
                if contrast_key(effect["filename"])
                and contrast_key(s["filename"]) == contrast_key(effect["filename"])
            ]
            by_name = [
                s for s in statistics
                if contrast_key(effect["name"])
                and contrast_key(s["name"]) == contrast_key(effect["name"])
            ]
            named = by_file if len(by_file) == 1 else by_name if len(by_name) == 1 else []
            correlations = {
                s["key"]: matching.fingerprint_correlation(
                    fingerprints.get((pid, effect["key"])), fingerprints.get((pid, s["key"]))
                )
                for s in statistics
                if fingerprints.get((pid, effect["key"])) and fingerprints.get((pid, s["key"]))
            }
            correlations = {key: r for key, r in correlations.items() if r is not None}
            ranked = sorted(correlations.items(), key=lambda item: -abs(item[1]))
            best, best_r = ranked[0] if ranked else (None, np.nan)
            second = abs(ranked[1][1]) if len(ranked) > 1 else 0.0
            name_pair = named[0]["key"] if named else None
            name_r = correlations.get(name_pair, np.nan) if name_pair else np.nan
            # a pair to compare scores on: a name match the maps agree with, or
            # a correlation clear of every other candidate
            if name_pair and name_r >= 0.8:
                partner = name_pair
            elif ranked and abs(best_r) >= 0.8 and abs(best_r) - second >= 0.1:
                partner = best
            else:
                partner = None
            rows.append(
                {
                    "paper": pid,
                    "effect": effect["key"],
                    "by_file": len(by_file),
                    "by_name": len(by_name),
                    "name_pair": name_pair,
                    "name_r": name_r,
                    "best": best,
                    "best_r": best_r,
                    "margin": abs(best_r) - second if ranked else np.nan,
                    "partner": partner,
                    "other_r": [r for key, r in correlations.items() if key != partner]
                    if partner
                    else [],
                    "partner_r": correlations.get(partner, np.nan) if partner else np.nan,
                }
            )
    return rows


def sweep_row(matching, pairs, thresholds, mixed=True):
    decided = redecide(matching, pairs, thresholds, mixed)
    own_best, foreign_best = analysis_level(matching, decided)
    assessed = decided[decided["outcome"] != matching.CANNOT_ASSESS]
    cross = assessed[~assessed["own"]]
    own = assessed[assessed["own"]]
    straight = assessed[assessed["named"] & (assessed["direction"] != "reversed")]
    reversed_ = assessed[assessed["named"] & (assessed["direction"] == "reversed")]
    one_sided = assignment_counts(matching, decided, both_sides=False)
    counts = assignment_counts(matching, decided)
    flags = [matching.REVERSED_SIGN, matching.LR_FLIP]
    return {
        "match": thresholds.match,
        "margin": thresholds.margin,
        "flip": thresholds.flip_margin,
        "mixed": mixed,
        "own coll. match": (own_best["outcome"] == matching.MATCH).mean(),
        "unrel. coll. match": (foreign_best["outcome"] == matching.MATCH).mean(),
        "unrel. coll. any": foreign_best["outcome"].isin(matching.ASSIGNABLE).mean(),
        "cross pair match": (cross["outcome"] == matching.MATCH).mean(),
        "named: match": (straight["outcome"] == matching.MATCH).mean(),
        "named: warned": straight["outcome"].isin(flags).mean(),
        "named: no match": (straight["outcome"] == matching.NO_MATCH).mean(),
        "named rev.: reversed": (reversed_["outcome"] == matching.REVERSED_SIGN).mean(),
        "own pair lr_flip": (own["outcome"] == matching.LR_FLIP).mean(),
        "cross pair lr_flip": (cross["outcome"] == matching.LR_FLIP).mean(),
        "assigned own, 1 side": one_sided["own_assigned"] / max(one_sided["own_total"], 1),
        "assigned own, 2 sides": counts["own_assigned"] / max(counts["own_total"], 1),
        "assigned unrel., 1 side": (
            one_sided["foreign_assigned"] / max(one_sided["foreign_total"], 1)
        ),
        "assigned unrel., 2 sides": counts["foreign_assigned"] / max(counts["foreign_total"], 1),
    }


def report(args):
    import pandas as pd

    matching = load_matching()
    pairs, all_maps = read_rows(args.work)
    related = pd.read_csv(args.work / "related.csv")
    papers = json.loads((args.work / "papers.json").read_text())
    pairs["own"] = pairs["own"].astype(bool)
    maps = all_maps
    if args.maps == "unthresholded":
        maps = unthresholded(all_maps)
        keep = set(zip(maps["paper"], maps["map_key"]))
        pairs = pairs[[key in keep for key in zip(pairs["paper"], pairs["map_key"])]]
        related = related[
            [
                (paper, a) in keep and (paper, b) in keep
                for paper, a, b in zip(related["paper"], related["map_a"], related["map_b"])
            ]
        ]
    # a presumed true pair: the names agree, and each is the other's best name match
    own = pairs[pairs["own"]].copy()
    own["name_similarity"] = own["name_similarity"].astype(float)
    best_for_analysis = own.loc[
        own.groupby(["paper", "analysis_id"])["name_similarity"].idxmax()
    ]
    best_for_map = own.loc[own.groupby(["paper", "map_key"])["name_similarity"].idxmax()]
    mutual = best_for_analysis.merge(
        best_for_map[["paper", "map_key", "analysis_id"]], on=["paper", "map_key", "analysis_id"]
    )
    mutual = mutual[mutual["name_similarity"] >= args.name_threshold]
    named_keys = set(zip(mutual["paper"], mutual["map_key"], mutual["analysis_id"]))
    pairs["named"] = [
        (p, m, a) in named_keys
        for p, m, a in zip(pairs["paper"], pairs["map_key"], pairs["analysis_id"])
    ]

    lines = []
    out = lines.append
    n_papers = pairs["paper"].nunique()
    out(f"maps included: {args.maps} ({len(maps)} of {len(all_maps)})")
    out(f"papers scored: {n_papers}")
    out(f"maps: {len(maps)}; analyses (own): {own.groupby(['paper', 'analysis_id']).ngroups}")
    out(f"pairs: {len(pairs)} ({int(pairs['own'].sum())} own, {int((~pairs['own']).sum())} cross)")
    out(f"named (presumed true) pairs: {int(pairs['named'].sum())}")
    directions = pairs[pairs["named"]]["direction"].value_counts().to_dict()
    out(f"  their stated directions: {directions}")
    out("")
    out("map status / reasons, all maps:")
    unusable = all_maps[all_maps["n_analyses_scored"] == 0]
    scored = int((all_maps["n_analyses_scored"] > 0).sum())
    out(f"  scored with at least one analysis: {scored} of {len(all_maps)}")
    thresholded = all_maps["read_thresholded"].astype(str) == "True"
    out(
        f"  read as thresholded: {int(thresholded.sum())}; flagged thresholded by "
        f"NeuroVault: {int((all_maps['nv_thresholded'].astype(str) == 'True').sum())}"
    )
    reasons = unusable["reason"].fillna("").str.replace(r"\d+", "N", regex=True)
    for reason, count in reasons.value_counts().head(12).items():
        out(f"  {count:5d}  {reason[:110]}")
    out("")
    out("voxel sizes:")
    for size, count in maps["voxel_size"].fillna("").value_counts().head(8).items():
        out(f"  {count:5d}  {size}")
    out("")
    timing = maps[maps["n_analyses_scored"] > 0]
    for label, sub in [
        ("2 mm", timing[timing["voxel_size"].astype(str).str.startswith("2x2x2")]),
        ("1 mm", timing[timing["voxel_size"].astype(str).str.startswith("1x1x1")]),
        ("3 mm", timing[timing["voxel_size"].astype(str).str.startswith("3x3x3")]),
        ("all", timing),
    ]:
        if len(sub):
            seconds = sub["seconds"]
            out(
                f"read+score seconds per real map ({label}, n={len(sub)}): "
                f"median {seconds.median():.3f}, p90 {seconds.quantile(0.9):.3f}, "
                f"max {seconds.max():.3f}; points scored per map median "
                f"{sub['n_points_scored'].median():.0f}"
            )
    out("")

    out("pair outcomes at the default thresholds:")
    named_straight = pairs[pairs["named"] & (pairs["direction"] != "reversed")]
    named_reversed = pairs[pairs["named"] & (pairs["direction"] == "reversed")]
    for label, sub in [
        ("own", pairs[pairs["own"]]),
        ("cross", pairs[~pairs["own"]]),
        ("named, same direction", named_straight),
        ("named, reversed", named_reversed),
    ]:
        counts = sub["outcome"].value_counts()
        total = len(sub)
        out(
            f"  {label:22s} n={total:6d}  "
            + "  ".join(f"{k}={counts.get(k, 0) / total:.1%}" for k in matching.OUTCOMES)
        )
    out("")

    sweep = []
    for match_threshold in (0.6, 0.625, 0.65, 0.675, 0.7, 0.75):
        # effect maps keep the gap to statistic maps the defaults have
        gap = matching.DEFAULT_THRESHOLDS.effect_match - matching.DEFAULT_THRESHOLDS.match
        thresholds = matching.Thresholds(match=match_threshold, effect_match=match_threshold + gap)
        sweep.append(sweep_row(matching, pairs, thresholds))
    sweep.append(sweep_row(matching, pairs, matching.DEFAULT_THRESHOLDS, mixed=False))
    for margin in (0.05, 0.15):
        thresholds = dataclasses.replace(matching.DEFAULT_THRESHOLDS, margin=margin)
        sweep.append(sweep_row(matching, pairs, thresholds))
    for flip in (0.1, 0.15, 0.25):
        thresholds = dataclasses.replace(matching.DEFAULT_THRESHOLDS, flip_margin=flip)
        sweep.append(sweep_row(matching, pairs, thresholds))
    table = pd.DataFrame(sweep)
    out("threshold sweep:")
    out(table.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
    out("")

    # by coordinate count, at the default thresholds
    own_best, foreign_best = analysis_level(matching, pairs)
    bins = [3, 5, 9, 17, 10_000]
    labels = ["3-4", "5-8", "9-16", "17+"]
    out("analysis level by coordinate count (default thresholds):")
    for label, low, high in zip(labels, bins[:-1], bins[1:]):
        o = own_best[(own_best["n_points"] >= low) & (own_best["n_points"] < high)]
        f = foreign_best[(foreign_best["n_points"] >= low) & (foreign_best["n_points"] < high)]
        out(
            f"  {label:5s} own collection matches {rate((o['outcome'] == 'match').sum(), len(o))}"
            f" (n={len(o)}); unrelated collection matches "
            f"{rate((f['outcome'] == 'match').sum(), len(f))} (n={len(f)})"
        )
    out("")
    out("score quantiles, best straight reading per (analysis, collection):")
    for label, sub in [("own", own_best), ("unrelated", foreign_best)]:
        straight = sub[["signed", "unsigned"]].max(axis=1)
        q = straight.quantile([0.1, 0.25, 0.5, 0.75, 0.9]).round(3).tolist()
        out(f"  {label:9s} p10/p25/p50/p75/p90 = {q}")
    out("")
    named = named_straight[named_straight["outcome"] != matching.CANNOT_ASSESS]
    if len(named):
        out("named pairs: outcome by whether the table reports negative statistics")
        for has_negative, sub in named.groupby(named["n_negative_values"] > 0):
            counts = sub["outcome"].value_counts(normalize=True).round(3).to_dict()
            out(f"  negative values reported={has_negative}: n={len(sub)} {counts}")
        out("named pairs: outcome by map type")
        for value_type, sub in named.groupby("map_value_type"):
            counts = sub["outcome"].value_counts(normalize=True).round(3).to_dict()
            out(f"  {value_type}: n={len(sub)} {counts}")
    out("")
    out("by map kind (statistic: t/z/F; effect: beta, cope, con, effect size):")
    kinds = pd.DataFrame(kind_summary(matching, pairs))
    out(kinds.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
    out("")
    out("statistic maps by type (95% intervals resample papers):")
    by_type = pd.DataFrame(statistic_type_summary(matching, pairs, statistic_types(papers)))
    for column in ("own 95%", "unrel. 95%"):
        by_type[column] = by_type[column].map(lambda bounds: "{:.3f}-{:.3f}".format(*bounds))
    out(by_type.to_string(index=False, float_format=lambda v: f"{v:.3f}"))
    out("")
    fingerprints = {}
    for line in open(args.work / "fingerprints.jsonl"):
        row = json.loads(line)
        fingerprints[(row["paper"], row["map_key"])] = matching.MapScores(
            map_id=row["map_key"],
            status=matching.SCORED,
            pairs={},
            fingerprint=tuple(row["values"]),
        )
    keep = set(zip(maps["paper"], maps["map_key"]))
    effect_pairs = pd.DataFrame(effect_statistic_pairs(matching, papers, fingerprints, keep))
    if len(effect_pairs):
        name_paired = effect_pairs[effect_pairs["name_pair"].notna()]
        out(
            f"effect maps in collections that also hold statistic maps: {len(effect_pairs)} "
            f"in {effect_pairs['paper'].nunique()} papers"
        )
        out(
            f"  paired by file name: {int((effect_pairs['by_file'] == 1).sum())}; by map name: "
            f"{int(((effect_pairs['by_file'] != 1) & (effect_pairs['by_name'] == 1)).sum())}; "
            f"no unique name match: {int(effect_pairs['name_pair'].isna().sum())}"
        )
        wrong = int((name_paired["name_r"] < 0.5).sum())
        out(
            f"  name pairs: median r {name_paired['name_r'].median():.3f}; r < 0.5 (different "
            f"maps despite the names): {wrong} of {len(name_paired)}"
        )
        out(
            f"  best-correlated statistic map is the name pair: "
            f"{(name_paired['best'] == name_paired['name_pair']).mean():.1%}"
        )
        decided = (effect_pairs["best_r"].abs() >= 0.8) & (effect_pairs["margin"] >= 0.1)
        agree = decided[name_paired.index] & (name_paired["best"] == name_paired["name_pair"])
        out(
            f"  correlation alone (|r| >= 0.8, 0.1 clear of the next): decides "
            f"{decided.mean():.1%} of effect maps; agrees with the name pair "
            f"{int(agree.sum())} of {int(decided[name_paired.index].sum())}"
        )
        paired = effect_pairs[effect_pairs["partner"].notna()]
        other = np.array([r for rs in paired["other_r"] for r in rs])
        out(
            f"  confident pairs: {len(paired)}; r with own statistic map >= 0.8: "
            f"{(paired['partner_r'] >= 0.8).mean():.1%}; other contrasts' statistic maps >= 0.8: "
            f"{(other >= 0.8).mean():.1%}, <= -0.8: {(other <= -0.8).mean():.1%} (n={len(other)})"
        )
        own = pairs[pairs["own"] & (pairs["outcome"] != matching.CANNOT_ASSESS)]
        by_key = own.set_index(["paper", "map_key", "analysis_id"])
        both_rows = []
        for row in paired.itertuples(index=False):
            for analysis_id in own[own["paper"] == row.paper]["analysis_id"].unique():
                try:
                    effect = by_key.loc[(row.paper, row.effect, analysis_id)]
                    statistic = by_key.loc[(row.paper, row.partner, analysis_id)]
                except KeyError:
                    continue
                both_rows.append(
                    {
                        "effect": effect["outcome"],
                        "statistic": statistic["outcome"],
                        "difference": max(effect["signed"], effect["unsigned"])
                        - max(statistic["signed"], statistic["unsigned"]),
                        "effect_peak": effect["peak_signed"],
                        "statistic_peak": statistic["peak_signed"],
                    }
                )
        compared = pd.DataFrame(both_rows)
        if len(compared):
            out(f"  same analysis, effect map against its statistic map (n={len(compared)}):")
            out(
                pd.crosstab(compared["statistic"], compared["effect"], margins=True)
                .to_string()
                .replace("\n", "\n    ")
            )
            hit = compared[compared["statistic"] == matching.MATCH]
            out(
                f"  where the statistic map matches (n={len(hit)}): the effect map matches "
                f"{(hit['effect'] == matching.MATCH).mean():.1%}; its reading differs by "
                f"{hit['difference'].median():+.3f} at the median; local peak share "
                f"{hit['effect_peak'].mean():.2f} against {hit['statistic_peak'].mean():.2f}"
            )
    out("")
    out("reverse contrasts (A > B and B > A tabled as two analyses):")
    in_scope = [paper for paper in papers if paper["base_study"] in set(pairs["paper"])]
    reverse_pairs = reverse_analysis_pairs(in_scope)
    out(
        f"  analysis pairs by name: {len(reverse_pairs)} in "
        f"{len({paper for paper, _, _ in reverse_pairs})} of {len(in_scope)} papers"
    )
    coverage = reverse_coverage(matching, pairs, reverse_pairs, related)
    for label, count in coverage.most_common():
        out(f"  {label}: {count}")
    for both_sides in (False, True):
        assigned = assignment_counts(matching, pairs, both_sides=both_sides)["own_pairs"]
        both = sum(
            (paper, first) in assigned and (paper, second) in assigned
            for paper, first, second in reverse_pairs
        )
        sides = "two sides" if both_sides else "one side"
        out(f"  both analyses get a map, {sides} per map: {rate(both, len(reverse_pairs))}")
    out("")
    out("related uploads within a collection (fingerprint correlation >= 0.95):")
    collections = pairs["paper"].nunique()
    kind_of = dict(zip(zip(all_maps["paper"], all_maps["map_key"]), all_maps["kind"]))
    same_kind = np.array(
        [
            kind_of.get((paper, first)) == kind_of.get((paper, second))
            for paper, first, second in zip(related["paper"], related["map_a"], related["map_b"])
        ],
        dtype=bool,
    )
    # an effect map and its own t map often correlate past 0.95; that is a set,
    # not a duplicate, so only maps of one kind count here
    for kind in (matching.INVERSE, matching.DUPLICATE):
        sub = related[(related["kind"] == kind) & same_kind]
        out(
            f"  {kind}, same kind of map: {len(sub)} pairs in {sub['paper'].nunique()} of "
            f"{collections} collections"
        )
    across = related[~same_kind]
    out(f"  effect and statistic maps correlating that strongly: {len(across)} pairs")
    text = "\n".join(lines)
    (args.work / "report.txt").write_text(text)
    table.to_csv(args.work / "sweep.csv", index=False)
    print(text)


STEPS = ["fetch", "select", "download", "score", "report"]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("step", choices=[*STEPS, "all"])
    parser.add_argument("--work", type=Path, required=True, help="working directory")
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument(
        "--nv-dump",
        help="a NeuroVault dump directory (e.g. nv-data/february_2024) for map flags",
    )
    parser.add_argument("--max-papers", type=int, default=150)
    parser.add_argument(
        "--max-maps", type=int, default=12, help="statistic and ambiguous maps per paper"
    )
    parser.add_argument("--max-effect-maps", type=int, default=12, help="effect maps per paper")
    parser.add_argument("--max-total-gb", type=float, default=4.0)
    parser.add_argument("--negatives", type=int, default=3, help="unrelated papers per paper")
    parser.add_argument("--name-threshold", type=float, default=0.5)
    parser.add_argument(
        "--maps",
        choices=["unthresholded", "all"],
        default="unthresholded",
        help="which maps the report counts; outreach asks for unthresholded ones",
    )
    parser.add_argument("--download-workers", type=int, default=6)
    parser.add_argument("--score-workers", type=int, default=4)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)
    args.work.mkdir(parents=True, exist_ok=True)

    steps = STEPS if args.step == "all" else [args.step]
    for step in steps:
        log(f"== {step}")
        globals()[step](args)


if __name__ == "__main__":
    main()
