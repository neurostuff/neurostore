"""NeuroVault-compatible analysis level normalization helpers."""

from neurostore.map_types import normalize_choice_value

ANALYSIS_LEVEL_CHOICES = (
    ("G", "group"),
    ("S", "single-subject"),
    ("M", "meta-analysis"),
    ("Other", "other"),
)

GROUP_LEVEL = "group"
SINGLE_SUBJECT_LEVEL = "single-subject"
META_ANALYSIS_LEVEL = "meta-analysis"
OTHER_LEVEL = "other"

# "other" belongs here because an uploader who picked it answered the question; a
# blank analysis_level did not, which is why unlabeled images are not in this set.
NON_GROUP_LEVELS = frozenset({SINGLE_SUBJECT_LEVEL, META_ANALYSIS_LEVEL, OTHER_LEVEL})

# The rest api serves the labels ("single-subject"), the database column holds the
# codes ("S"), and stored payloads can predate either, so both are accepted.
_ANALYSIS_LEVEL_LOOKUP = {}
for _code, _label in ANALYSIS_LEVEL_CHOICES:
    _ANALYSIS_LEVEL_LOOKUP[normalize_choice_value(_code)] = _label
    _ANALYSIS_LEVEL_LOOKUP[normalize_choice_value(_label)] = _label

_ANALYSIS_LEVEL_LOOKUP.update(
    {
        "single subject": SINGLE_SUBJECT_LEVEL,
        "singlesubject": SINGLE_SUBJECT_LEVEL,
        "meta analysis": META_ANALYSIS_LEVEL,
        "metaanalysis": META_ANALYSIS_LEVEL,
    }
)

# Every accepted spelling of a non-group level, for matching stored json in sql.
NON_GROUP_NORMALIZED_VALUES = frozenset(
    alias for alias, level in _ANALYSIS_LEVEL_LOOKUP.items() if level in NON_GROUP_LEVELS
)


def canonicalize_analysis_level(value, default=None, missing_default=None):
    """Convert an analysis level code/label/alias to a canonical NeuroVault label.

    Behavior:
    - Missing/null/empty input -> ``missing_default`` (default: None)
    - Unknown non-empty input -> ``default`` (default: None)

    Unlike :func:`neurostore.map_types.canonicalize_map_type`, an unrecognized value
    does not fall back to "other": callers use this to decide what an image is *not*,
    and a value nobody recognizes says nothing either way.
    """

    normalized = normalize_choice_value(value)
    if normalized is None:
        return missing_default
    return _ANALYSIS_LEVEL_LOOKUP.get(normalized, default)


def is_non_group_analysis_level(value):
    """True only when a payload states outright that it is not group level.

    Missing, empty and unrecognized values are all False: NeuroVault leaves
    ``analysis_level`` unset on a large share of its images.
    """

    return canonicalize_analysis_level(value) in NON_GROUP_LEVELS
