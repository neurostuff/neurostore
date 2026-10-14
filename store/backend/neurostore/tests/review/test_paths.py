import pytest

from neurostore.review import ReviewError
from neurostore.review import paths


def _group():
    return {
        "local_id": "grp_x",
        "age_mean": {"value": 31.5, "extraction_status": "extracted"},
        "sex_distribution": [
            {"category": {"value": "female"}, "count": {"value": 10}},
            {"category": {"value": "male"}, "count": {"value": 12}},
        ],
    }


def _analysis():
    return {
        "local_id": "an_1",
        "groups": [
            {"group": "grp_x", "n": {"value": 20}},
            {"group": "grp_y", "n": {"value": 18}},
        ],
        "model": {"terms": [{"name": {"value": "diagnosis"}, "unit": None}]},
        "cells": [
            {"term": "trm_1", "level": {"value": "high"}, "direction": {"value": "positive"}},
            {"term": "trm_1", "level": {"value": "low"}, "direction": {"value": "negative"}},
        ],
    }


@pytest.mark.parametrize(
    "path, expected",
    [
        ("age_mean", (("age_mean", None),)),
        ("age_mean.value", (("age_mean", None), ("value", None))),
        ("groups[group=grp_x].n", (("groups", (("group", "grp_x"),)), ("n", None))),
        ("sex_distribution[#0].count", (("sex_distribution", 0), ("count", None))),
        ("groups[group=a=b].n", (("groups", (("group", "a=b"),)), ("n", None))),
        (
            "cells[term=trm_1,level=high].direction",
            (("cells", (("term", "trm_1"), ("level", "high"))), ("direction", None)),
        ),
    ],
)
def test_parse(path, expected):
    assert paths.parse(path) == expected


@pytest.mark.parametrize(
    "path", ["", "groups[", "groups[#x].n", ".n", "groups..n", "1abc", "groups[=x]", "a b"]
)
def test_malformed_path_raises_naming_it(path):
    with pytest.raises(ReviewError, match="malformed field path") as raised:
        paths.parse(path)
    assert repr(path) in str(raised.value)


@pytest.mark.parametrize(
    "obj, path, expected",
    [
        (_group(), "age_mean.value", 31.5),
        (_group(), "sex_distribution[#1].count", {"value": 12}),
        (_group(), "sex_distribution[category=male].count.value", 12),
        (_analysis(), "groups[group=grp_y].n.value", 18),
        (_analysis(), "model.terms[name=diagnosis].unit", None),
        (_analysis(), "cells[term=trm_1,level=low].direction.value", "negative"),
        (_group(), "age_median", None),
    ],
)
def test_get(obj, path, expected):
    assert paths.get(obj, path) == expected


def test_get_through_an_absent_object_is_none():
    assert paths.get(_group(), "age_median.value") is None


def test_an_empty_selector_value_matches_an_item_whose_key_is_absent():
    analysis = {"groups": [{"n": {"value": 1}}, {"group": "grp_x", "n": {"value": 2}}]}
    assert paths.get(analysis, "groups[group=].n") == {"value": 1}


def test_a_selector_value_may_contain_an_equals_sign():
    analysis = {"groups": [{"group": "a=b", "n": {"value": 3}}]}
    assert paths.get(analysis, "groups[group=a=b].n") == {"value": 3}


def test_an_ambiguous_selector_raises():
    analysis = {"groups": [{"group": "grp_x", "n": {"value": 1}},
                           {"group": "grp_x", "n": {"value": 2}}]}
    with pytest.raises(ReviewError, match="2 items match the selector"):
        paths.get(analysis, "groups[group=grp_x].n")


def test_a_position_past_the_end_raises_review_error():
    with pytest.raises(ReviewError, match="no item at position 2"):
        paths.get(_group(), "sex_distribution[#2].count")


@pytest.mark.parametrize(
    "path", ["groups[group=grp_z].n", "groups[#5].n", "groups[group=grp_x].n.value.x"]
)
def test_get_through_a_missing_item_raises(path):
    with pytest.raises(ReviewError, match="groups"):
        paths.get(_analysis(), path)


@pytest.mark.parametrize(
    "obj, path",
    [
        (_group(), "age_mean"),
        (_group(), "sex_distribution[#0].count.value"),
        (_analysis(), "groups[group=grp_x].n"),
        (_analysis(), "cells[term=trm_1,level=high].label"),
        (_analysis(), "design.allocation"),
    ],
)
def test_set_then_get_round_trips(obj, path):
    paths.set_path(obj, path, {"value": "new"})
    assert paths.get(obj, path) == {"value": "new"}


def test_set_changes_only_the_selected_item():
    analysis = _analysis()
    paths.set_path(analysis, "groups[group=grp_y].n", {"value": 3})
    assert analysis["groups"][0]["n"] == {"value": 20}
    assert analysis["groups"][1]["n"] == {"value": 3}
