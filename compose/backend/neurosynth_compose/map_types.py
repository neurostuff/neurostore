"""NeuroVault-compatible map type normalization helpers."""

import re


MAP_TYPE_CHOICES = (
    ("T", "T map"),
    ("Z", "Z map"),
    ("F", "F map"),
    ("X2", "Chi squared map"),
    ("P", "P map (given null hypothesis)"),
    ("IP", '1-P map ("inverted" probability)'),
    ("M", "multivariate-beta map"),
    ("U", "univariate-beta map"),
    ("R", "ROI/mask"),
    ("Pa", "parcellation"),
    ("A", "anatomical"),
    ("V", "variance"),
    ("Other", "other"),
)

MAP_TYPE_LABELS = dict(MAP_TYPE_CHOICES)


def _normalize(raw_value):
    if raw_value is None:
        return None
    value = str(raw_value).strip()
    if not value:
        return None
    return re.sub(r"\s+", " ", value).casefold()


_MAP_TYPE_LOOKUP = {}
for _code, _label in MAP_TYPE_CHOICES:
    _MAP_TYPE_LOOKUP[_normalize(_code)] = _code
    _MAP_TYPE_LOOKUP[_normalize(_label)] = _code

_MAP_TYPE_LOOKUP.update(
    {
        "chi-squared map": "X2",
        "chi square map": "X2",
        "x2": "X2",
        "x^2": "X2",
        "1-p map ('inverted' probability)": "IP",
        "roi / mask": "R",
        "u map": "U",
        "m map": "M",
        "v map": "V",
        "variance map": "V",
        "beta": "U",
        "beta map": "U",
        "univariate beta map": "U",
        "multivariate beta map": "M",
    }
)


def canonicalize_map_type(value, default="Other", missing_default=None):
    """Convert a map type code/label/alias to a canonical NeuroVault code.

    Behavior:
    - Missing/null/empty input -> ``missing_default`` (default: None)
    - Unknown non-empty input -> ``default`` (default: "Other")
    """

    normalized = _normalize(value)
    if normalized is None:
        return missing_default
    return _MAP_TYPE_LOOKUP.get(normalized, default)


def map_type_label(value, default="Other", missing_default=None):
    """Return a user-facing NeuroVault map type label."""

    code = canonicalize_map_type(
        value,
        default=default,
        missing_default=missing_default,
    )
    if code is None:
        return None
    return MAP_TYPE_LABELS.get(code, MAP_TYPE_LABELS["Other"])
