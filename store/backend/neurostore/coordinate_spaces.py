"""Coordinate space normalization for points.

NiMARE transforms between coordinate spaces only when a point's space is exactly
``"MNI"`` or ``"TAL"``; any other spelling goes into a meta-analysis untransformed.
Known spellings of the two are folded to those strings when a point is written.
Anything else is kept as given, and a missing space stays missing: it is never
defaulted to MNI.
"""

import re

MNI = "MNI"
TAL = "TAL"
OTHER = "OTHER"
UNKNOWN = "UNKNOWN"

# Keys are casefolded with everything but letters and digits removed, so
# "MNI-152", "mni 152" and "MNI152" share one entry.
_SPACE_LOOKUP = {
    **dict.fromkeys(
        (
            "mni",
            "mni152",
            "mni305",
            "icbm",
            "icbm152",
            "mniicbm",
            "mniicbm152",
            "icbmmni",
            "icbmmni152",
            "spmmni",
            "genericmni",
            "montrealneurologicalinstitute",
            "mni152nlin2009casym",
            "mni152nlin2009csym",
            "mni152nlin6asym",
            "mni152nlin6sym",
            "mni152lin",
        ),
        MNI,
    ),
    **dict.fromkeys(
        (
            "tal",
            "talairach",
            "talairachtournoux",
            "talairachandtournoux",
            "talairach1988",
            "tal88",
            "tt",
            "tt88",
        ),
        TAL,
    ),
    "other": OTHER,
    "unknown": UNKNOWN,
}

_TRAILING_WORDS = re.compile(r"(space|coordinates?|template)$")


def _lookup_key(value):
    key = re.sub(r"[^0-9a-z]", "", value.casefold())
    return _TRAILING_WORDS.sub("", key) or key


def normalize_space(value):
    """Return ``"MNI"`` or ``"TAL"`` for a known spelling of either.

    ``"other"`` and ``"unknown"`` in any case become ``"OTHER"`` and
    ``"UNKNOWN"``, the spellings the frontend and the bulk ingesters already
    store. Missing or blank input returns None. Any other value is returned
    stripped but otherwise as given, so a space NiMARE cannot transform stays
    visible as itself rather than being guessed.
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return _SPACE_LOOKUP.get(_lookup_key(text), text)
