"""Coordinate space normalization for points.

NiMARE transforms between coordinate spaces only when a point's space is exactly
``"MNI"`` or ``"TAL"``; any other spelling goes into a meta-analysis untransformed.
Every space a point is written with is folded to one of ``MNI``, ``TAL``, ``OTHER``
or ``UNKNOWN``. A missing space stays missing: it is never defaulted to MNI.

The family patterns are pondie's ``pondie.normalization.coordinate_space.RULES``,
so a space pondie reads and the point neurostore stores agree.
"""

import re

MNI = "MNI"
TAL = "TAL"
OTHER = "OTHER"
UNKNOWN = "UNKNOWN"

_RULES = (
    (
        MNI,
        re.compile(
            r"\bmni|\bnmi\b|\bicbm|montreal\s+neurolog|"
            r"international\s+consortium\s+for\s+brain\s+mapping|\bcolin\s*27",
            re.IGNORECASE,
        ),
    ),
    # Beyond pondie: "T&T", and "2tal" so that mni2tal matches both families.
    (
        TAL,
        re.compile(
            r"\btal\b|t[ao]l[ai]+r[ai]+ch|tournoux|2tal\b|\bt\s*&\s*t\b",
            re.IGNORECASE,
        ),
    ),
    (
        OTHER,
        re.compile(
            r"^\s*other\s*$|\bsurface\b|\bfsaverage|\bfsLR\b|\bnative\b|"
            r"\bdartel\b|\bsuit\b|\bfmrib58|custom(?:i[sz]ed)?\b|in-house|"
            r"\w+[\s-]specific\b|\bspm\s?\d+\b",
            re.IGNORECASE,
        ),
    ),
)

_UNKNOWN = re.compile(
    r"^\s*(unknown|not\s+(reported|stated|specified)|n/?a|none|unspecified)\s*$",
    re.IGNORECASE,
)


def normalize_space(value):
    """Fold a point's space to ``"MNI"``, ``"TAL"``, ``"OTHER"`` or ``"UNKNOWN"``.

    - Missing or blank input returns None.
    - A spelling of MNI or TAL ("MNI152 2mm", "Talairach & Tournoux 1988")
      returns that space.
    - A string naming both ("MNI converted to Talairach", "mni2tal") returns
      ``"UNKNOWN"``: which space the numbers are in is not decidable from it.
    - "unknown", "not reported" and the like return ``"UNKNOWN"``.
    - Anything else returns ``"OTHER"``, the value the frontend shows and writes
      back for any space it does not know.
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if _UNKNOWN.match(text):
        return UNKNOWN
    hits = [space for space, pattern in _RULES if pattern.search(text)]
    if MNI in hits and TAL in hits:
        return UNKNOWN
    return hits[0] if hits else OTHER
