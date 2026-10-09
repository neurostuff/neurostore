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
        ("MNI152 2mm", "MNI"),
        ("MNI (Montreal Neurological Institute)", "MNI"),
        ("ICBM152 2009c", "MNI"),
        ("MNI/ICBM", "MNI"),
        ("MNI152NLin2009cAsym", "MNI"),
        ("Colin27", "MNI"),
        ("MNI space", "MNI"),
        ("TAL", "TAL"),
        ("tal", "TAL"),
        ("Talairach", "TAL"),
        ("Talairach & Tournoux 1988", "TAL"),
        ("Talairach and Tournoux (1988)", "TAL"),
        ("Talairach space coordinates", "TAL"),
        ("T&T", "TAL"),
        ("tal88", "TAL"),
        ("TT", "TAL"),
        ("TT88", "TAL"),
        ("TLRC", "TAL"),
        ("+tlrc", "TAL"),
        ("TT_N27", "TAL"),
        ("T88", "TAL"),
        # Names both spaces: which one the numbers are in is not decidable.
        ("MNI converted to Talairach", "UNKNOWN"),
        ("mni2tal", "UNKNOWN"),
        ("tal2mni", "UNKNOWN"),
        ("tal2icbm", "UNKNOWN"),
        ("icbm2tal", "UNKNOWN"),
        ("unknown space", "UNKNOWN"),
        ("n.a.", "UNKNOWN"),
        ("N/A", "UNKNOWN"),
        ("not applicable", "UNKNOWN"),
        ("none reported", "UNKNOWN"),
        ("missing", "UNKNOWN"),
        ("null", "UNKNOWN"),
        ("?", "UNKNOWN"),
        ("-", "UNKNOWN"),
        ("Unknown", "UNKNOWN"),
        ("not reported", "UNKNOWN"),
        ("other", "OTHER"),
        ("OTHER", "OTHER"),
        ("native", "OTHER"),
        ("fsaverage", "OTHER"),
        ("Paxinos and Watson", "OTHER"),
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


def test_migration_normalizes_existing_point_spaces(session):
    import importlib.util
    from pathlib import Path

    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import text

    path = next(
        (Path(__file__).parents[2] / "migrations" / "versions").glob(
            "e7a9c1d3f5b7_*.py"
        )
    )
    spec = importlib.util.spec_from_file_location("normalize_point_space", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    for sample in ("Talairach & Tournoux 1988", "MNI152 2mm", "tal2mni", "n.a.", "native"):
        assert migration._normalize_space(sample) == normalize_space(sample)

    raw = ["Talairach", "", "MNI152 2mm", "native", "MNI", "UNKNOWN", None]
    for i, space in enumerate(raw):
        session.execute(
            text("INSERT INTO points (id, space) VALUES (:id, :space)"),
            {"id": f"spacemig{i}", "space": space},
        )

    connection = session.connection()
    with Operations.context(MigrationContext.configure(connection)):
        migration.upgrade()

    stored = dict(
        session.execute(
            text("SELECT id, space FROM points WHERE id LIKE 'spacemig%'")
        ).all()
    )
    assert [stored[f"spacemig{i}"] for i in range(len(raw))] == [
        "TAL",
        None,
        "MNI",
        "OTHER",
        "MNI",
        "UNKNOWN",
        None,
    ]
