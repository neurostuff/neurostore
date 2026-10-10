"""Coordinate space normalization for points.

NiMARE transforms between coordinate spaces only when a point's space is exactly
``"MNI"`` or ``"TAL"``; any other spelling goes into a meta-analysis untransformed.
Every space a point is written with is folded to ``MNI``, ``TAL`` or ``OTHER`` (a
stated space that is neither), or to None when no space is stated. None is never
defaulted to MNI.

The family patterns are pondie's ``pondie.normalization.coordinate_space.RULES``,
so a space pondie reads and the point neurostore stores agree.
"""

import re

MNI = "MNI"
TAL = "TAL"
OTHER = "OTHER"

_RULES = (
    (
        MNI,
        re.compile(
            r"\bmni|\bnmi\b|\bicbm|2(?:mni|icbm)|montreal\s+neurolog|"
            r"international\s+consortium\s+for\s+brain\s+mapping|\bcolin\s*27",
            re.IGNORECASE,
        ),
    ),
    # Beyond pondie: T&T, TT88 and AFNI's TLRC / T88; and the digit forms
    # (mni2tal, tal2mni, icbm2tal) match both families, so they are not guessed.
    (
        TAL,
        re.compile(
            r"\btal\b|t[ao]l[ai]+r[ai]+ch|tournoux|\bt\s*&\s*t\b|"
            r"\btal88\b|\btt(?:88)?\b|\bt88\b|tlrc|\btt_n27|2tal\b|\btal2",
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

# Strings that say no space was stated; they store as None, like a blank.
_NOT_STATED = re.compile(
    r"^\s*(?:unknown(?:\s+space)?|not\s+(?:reported|stated|specified|applicable|available)|"
    r"n\.?\s*/?\s*a\.?|none(?:\s+reported)?|missing|null|unspecified|[\W_]+)\s*$",
    re.IGNORECASE,
)


def normalize_space(value):
    """Fold a point's space to ``"MNI"``, ``"TAL"``, ``"OTHER"`` or None.

    - Missing or blank input returns None.
    - "unknown", "not reported", "n.a.", "?" and the like return None.
    - A spelling of MNI or TAL ("MNI152 2mm", "Talairach & Tournoux 1988")
      returns that space.
    - A string naming both ("MNI converted to Talairach", "mni2tal", "tal2mni")
      returns None: which space the numbers are in is not decidable.
    - Anything else returns ``"OTHER"``, the value the frontend shows and writes
      back for any space it does not know.
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if _NOT_STATED.match(text):
        return None
    hits = [space for space, pattern in _RULES if pattern.search(text)]
    if MNI in hits and TAL in hits:
        return None
    return hits[0] if hits else OTHER
