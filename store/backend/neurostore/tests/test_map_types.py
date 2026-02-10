import pytest

from neurostore.map_types import canonicalize_map_type, map_type_label


@pytest.mark.parametrize(
    "raw,expected_code,expected_label",
    [
        ("T", "T", "T map"),
        ("Z map", "Z", "Z map"),
        ("Chi squared map", "X2", "Chi squared map"),
        (
            "1-P map (\"inverted\" probability)",
            "IP",
            '1-P map ("inverted" probability)',
        ),
        ("parcellation", "Pa", "parcellation"),
        ("other", "Other", "other"),
        ("unknown", "Other", "other"),
        ("", None, None),
        (None, None, None),
    ],
)
def test_map_type_normalization(raw, expected_code, expected_label):
    assert canonicalize_map_type(raw, default=None) == expected_code
    assert map_type_label(raw, default=None) == expected_label
