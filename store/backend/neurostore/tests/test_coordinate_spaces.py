import pytest

from neurostore.coordinate_spaces import normalize_space
from neurostore.models import Point


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("MNI", "MNI"),
        ("mni", "MNI"),
        (" MNI152 ", "MNI"),
        ("MNI-152", "MNI"),
        ("MNI305", "MNI"),
        ("ICBM", "MNI"),
        ("ICBM 152", "MNI"),
        ("MNI/ICBM", "MNI"),
        ("MNI152NLin2009cAsym", "MNI"),
        ("MNI space", "MNI"),
        ("TAL", "TAL"),
        ("tal", "TAL"),
        ("Talairach", "TAL"),
        ("Talairach & Tournoux", "TAL"),
        ("Talairach coordinates", "TAL"),
        ("T&T", "TAL"),
        ("other", "OTHER"),
        ("OTHER", "OTHER"),
        ("Unknown", "UNKNOWN"),
        # Not a known spelling of either space: kept as given, never guessed.
        ("MNI converted to Talairach", "MNI converted to Talairach"),
        ("mni2tal", "mni2tal"),
        ("Paxinos and Watson", "Paxinos and Watson"),
        ("  native  ", "native"),
        ("", None),
        ("   ", None),
        (None, None),
    ],
)
def test_normalize_space(raw, expected):
    assert normalize_space(raw) == expected


def test_point_space_is_normalized_on_write():
    point = Point(x=0, y=0, z=0, space="Talairach")
    assert point.space == "TAL"

    point.space = "mni152"
    assert point.space == "MNI"

    point.space = None
    assert point.space is None


def test_point_without_space_is_not_defaulted_to_mni():
    assert Point(x=0, y=0, z=0).space is None
