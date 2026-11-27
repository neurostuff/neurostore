"""Which uploaded maps are statistics, effects or variances, and which go together.

An analysis's maps come as a set: a t or z map, usually its effect map (FSL cope, SPM
con, nilearn effect_size, FitLins stat-effect), sometimes its variance (varcope,
effect_variance). The matcher reads a t/z map against the paper's coordinates far
better than an effect map (store/scripts/outreach_matching_calibration.md), so each set
is matched through its statistic map, and its effect and variance maps take the same
analysis.

A map's kind comes from its header when that says (NIfTI intent codes, SPM's
descriptions), else its name. A pairing comes from where the files sat when the author
chose a whole results folder (the same folder and contrast number), else their names,
and an effect map's pairing is checked by how its values correlate with the statistic
map's. Names alone are only a hint: authors rename and move their maps.
"""

from __future__ import annotations

import posixpath
import re

STATISTIC = "statistic"
EFFECT = "effect"
VARIANCE = "variance"
OTHER = "other"
MAP_TYPES = ("t", "z", "f", "effect", "variance", "other")
KIND = {"t": STATISTIC, "z": STATISTIC, "f": STATISTIC, "effect": EFFECT,
        "variance": VARIANCE, "other": OTHER}

#: An effect map and its own t/z map correlate at least this much (96% of NeuroVault's
#: pairs); at or below its negation one of them is the reverse contrast.
SAME_CONTRAST = 0.8

# (map type, pattern on the lower-cased name), first match wins: varcope before cope.
NAME_RULES = (
    ("variance", re.compile(
        r"varcope|effect_variance|stat-variance|variance|(^|[_\-])var[_\-]?\d")),
    ("effect", re.compile(r"(^|[_\-/])cope\d|(^|[_\-])con_\d|effect_size|stat-effect|"
                          r"(^|[_\-])effect([_\-.]|$)|(^|[_\-])beta([_\-]?\d|[_\-.]|$)")),
    ("z", re.compile(r"zstat|z_score|zscore|stat-z([_\-.]|$)|spmz|(^|[_\-])z([_\-.]|$)")),
    ("t", re.compile(r"tstat|spmt|stat-t([_\-.]|$)|t_stat|(^|[_\-])t([_\-.]|$)")),
    ("f", re.compile(r"fstat|spmf|stat-f([_\-.]|$)")),
)
# What a name says beyond its kind: removed to compare a set's names.
_KIND_TOKENS = re.compile(
    r"varcope|cope|zstat|tstat|fstat|spmt|spmf|spmz|con|effect_size|effect_variance|"
    r"z_score|zscore|t_score|stat-(t|z|f|effect|variance)|variance|effect|beta|statmap|"
    # a lone t, z or F, as in faces_T beside faces_Beta
    r"(?<![a-z0-9])[tzf](?![a-z0-9])"
)
_EXTENSION = re.compile(r"\.nii(\.gz)?$")


def type_from_header(image):
    """The map type a NIfTI header states, or None."""
    header = image.header
    try:
        intent = header.get_intent()[0]
    except Exception:
        intent = None
    by_intent = {"t test": "t", "z score": "z", "f test": "f"}
    if intent in by_intent:
        return by_intent[intent]
    try:
        description = bytes(header["descrip"]).decode("latin-1").strip("\x00 ")
    except Exception:
        description = ""
    if description.startswith("SPM{T"):
        return "t"
    if description.startswith("SPM{F"):
        return "f"
    if description.startswith("SPM contrast"):
        return "effect"
    return None


def type_from_name(name):
    stem = _EXTENSION.sub("", posixpath.basename(name.lower()))
    for map_type, pattern in NAME_RULES:
        if pattern.search(stem):
            return map_type
    return None


def detect_type(image, filename, path=None):
    """(map type, how it was told): from the header, else the name, else "other"."""
    from_header = type_from_header(image) if image is not None else None
    if from_header:
        return from_header, "header"
    from_name = type_from_name(path or filename)
    if from_name:
        return from_name, "name"
    return "other", None


def set_key(filename, path=None):
    """(folder, stem): what two maps of one set share. ``cope3`` and ``zstat3`` in one
    folder share ("…/stats", "3"); ``con_0003`` and ``spmT_0003`` share "3"."""
    full = (path or filename).lower()
    folder = posixpath.dirname(full)
    stem = _EXTENSION.sub("", posixpath.basename(full))
    stem = _KIND_TOKENS.sub(" ", stem)
    stem = re.sub(r"\d+", lambda m: str(int(m.group())), stem)
    stem = re.sub(r"[^a-z0-9]+", " ", stem).strip()
    return folder, stem


def _name_match(member, statistic):
    member_folder, member_stem = set_key(member["filename"], member.get("path"))
    stat_folder, stat_stem = set_key(statistic["filename"], statistic.get("path"))
    if member_stem != stat_stem:
        return False
    # Both from a chosen folder: they must sit together. Otherwise the names decide.
    return member_folder == stat_folder or not (member.get("path") and statistic.get("path"))


def pair(maps, correlation):
    """{member id: {"partner_id", "r", "by", "reversed"}} for each effect or variance map.

    ``maps`` are {"id", "filename", "path", "map_type"}; ``correlation(a, b)`` is the two
    maps' fingerprint correlation or None. An effect map pairs with a statistic map whose
    name matches and whose values correlate (or cannot be compared), or, with no name to
    go by, with the one statistic map it clearly correlates with. A variance map pairs by
    name only: its values do not track the statistic's. A pairing at or below
    -SAME_CONTRAST is kept but marked reversed, for the author to look at.
    """
    statistics = [m for m in maps if KIND.get(m["map_type"]) == STATISTIC]
    pairs = {}
    for member in maps:
        kind = KIND.get(member["map_type"])
        if kind not in (EFFECT, VARIANCE):
            continue
        named = [s for s in statistics if _name_match(member, s)]
        if kind == VARIANCE:
            if len(named) == 1:
                pairs[member["id"]] = {
                    "partner_id": named[0]["id"], "r": None, "by": "name", "reversed": False
                }
            continue
        scored = [(s, correlation(member["id"], s["id"])) for s in statistics]
        found = None
        candidates = [(s, r) for s, r in scored if s in named]
        agreeing = [(s, r) for s, r in candidates if r is None or abs(r) >= SAME_CONTRAST]
        if agreeing:
            # FSL writes a t and a z map of each contrast side by side: take the one
            # that correlates best, and z before t when they tie.
            statistic, r = min(agreeing, key=lambda sr: (
                sr[1] is None, -abs(sr[1] or 0), {"z": 0, "t": 1}.get(sr[0]["map_type"], 2)))
            found = (statistic, r, "name" if r is None else "name+correlation")
        elif not named:
            strong = [(s, r) for s, r in scored if r is not None and abs(r) >= SAME_CONTRAST]
            if len(strong) == 1:
                found = (strong[0][0], strong[0][1], "correlation")
        if found is not None:
            statistic, r, by = found
            pairs[member["id"]] = {
                "partner_id": statistic["id"],
                "r": r,
                "by": by,
                "reversed": r is not None and r <= -SAME_CONTRAST,
            }
    return pairs
