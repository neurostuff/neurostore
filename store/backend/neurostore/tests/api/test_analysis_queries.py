"""POST /analysis-queries/, GET /analysis-terms/, and the annotation's analysis_query."""

import pytest

from neurostore.database import db
from neurostore.tests import analysis_fixtures as af
from neurostore.tests.utils import ordered_note_keys

pytestmark = pytest.mark.anyio

SCHIZOPHRENIA, NICOTINE, CONDUCT = "ya2RC6UYbibC", "6SKTGteXbbBs", "AhxosLhYA5YG"


@pytest.fixture
def papers(session):
    """Base study id of each fixture record, uploaded."""
    ids = {name: af.upload(name)["base_study_id"] for name in af.RECORDS}
    db.session.commit()
    return ids


async def _query(client, query, status=200, **body):
    """The query's response; every selected study unless the body pages them."""
    body.setdefault("paginate", False)
    resp = await client.post("/api/analysis-queries/", data={"query": query, **body})
    assert resp.status_code == status, resp.json()
    return resp.json()


def _rows(result):
    """Each listed analysis beside its study and paper."""
    return [
        {
            "study": s["study"],
            "base_study": s["base_study"],
            "analysis": a["id"],
            **{k: v for k, v in a.items() if k != "id"},
        }
        for s in result["results"]
        for a in s["analyses"]
    ]


def _studies(result):
    return [s["study"] for s in result["results"]]


def _names(result):
    return sorted(r["name"] for r in _rows(result))


def _papers(result, papers):
    by_id = {v: k for k, v in papers.items()}
    return sorted({by_id[r["base_study"]] for r in _rows(result)})


def _matched_by(result, criterion):
    return sorted({r["matched_by"].get(criterion) for r in _rows(result)}, key=str)


async def test_medical_condition_matches_by_text_or_by_id(auth_client, papers):
    by_text = await _query(auth_client, {"medical_condition": "schizophrenia"}, funnel=True)
    by_id = await _query(auth_client, {"medical_condition": {"ids": ["MONDO:0004985"]}})
    # An id is not read as text: no record's wording says "MONDO".
    as_text = await _query(auth_client, {"medical_condition": "MONDO:0004985"})
    either = await _query(
        auth_client,
        {
            "medical_condition": {
                "ids": "MONDO:0004985",
                "text": "nicotine*",
                "when_unmapped": "text",
            }
        },
    )

    assert _names(by_text) == ["schizophrenia > BDp", "schizophrenia > control"]
    assert _names(by_id) == ["schizophrenia > BDp"]
    assert _rows(as_text) == []
    assert _papers(either, papers) == [NICOTINE, SCHIZOPHRENIA]
    assert _matched_by(by_text, "medical_condition") == ["text"]
    assert _matched_by(by_id, "medical_condition") == ["id"]
    assert _matched_by(either, "medical_condition") == ["id", "text"]
    assert by_text["metadata"] == {"total_count": 1, "analysis_count": 2}
    assert by_text["searched"] == {"analyses": 5, "base_studies": 3}
    assert "funnel" not in by_id and "searched" not in by_id


async def test_when_unmapped_decides_the_analyses_whose_wording_mapped_to_nothing(
    auth_client, papers
):
    # Nicotine dependence and conduct disorder are stated and map to no MONDO term.
    by_wording = await _query(
        auth_client, {"medical_condition": {"text": "nicotine*", "when_unmapped": "text"}}
    )
    mapped_only = await _query(auth_client, {"medical_condition": "nicotine*"})
    unmapped_in = await _query(
        auth_client,
        {"medical_condition": {"ids": ["MONDO:0005090"], "when_unmapped": "include"}},
        funnel=True,
    )

    assert _papers(by_wording, papers) == [NICOTINE]
    assert _rows(mapped_only) == []
    assert _papers(unmapped_in, papers) == [NICOTINE, CONDUCT, SCHIZOPHRENIA]
    assert _matched_by(unmapped_in, "medical_condition") == ["id", "unmapped"]
    assert unmapped_in["funnel"][0]["unmapped"] == 3


async def test_an_unmapped_analysis_needs_text_to_match_under_when_unmapped_text(
    auth_client, papers
):
    # Every schizophrenia analysis holds the id, and nothing judges the unmapped ones.
    not_schizophrenia = {"none": {"ids": ["MONDO:0005090"]}}
    by_ids = await _query(auth_client, {"medical_condition": not_schizophrenia})
    included = await _query(
        auth_client, {"medical_condition": {**not_schizophrenia, "when_unmapped": "include"}}
    )

    assert _rows(by_ids) == []
    assert _papers(included, papers) == [NICOTINE, CONDUCT]
    assert _matched_by(included, "medical_condition") == ["unmapped"]


async def test_an_unmapped_contrast_key_is_excluded_unless_included(auth_client, session):
    af.upload(SCHIZOPHRENIA, af.unmap_names(af.record(SCHIZOPHRENIA), "schizophrenia > BDp"))
    db.session.commit()

    bare = await _query(auth_client, {"contrast": {"key": "working_memory_span"}})
    included = await _query(
        auth_client,
        {"contrast": {"key": {"ids": "working_memory_span", "when_unmapped": "include"}}},
    )

    assert _names(bare) == ["schizophrenia > control"]
    assert bare["query"]["contrast"]["key"]["when_unmapped"] == "exclude"
    assert _names(included) == ["schizophrenia > BDp", "schizophrenia > control"]
    assert _matched_by(included, "contrast.key") == ["id", "unmapped"]


async def test_an_id_matches_its_descendants_unless_told_not_to(auth_client, papers):
    family = await _query(auth_client, {"contrast": {"set": "working_memory"}})
    exact = await _query(
        auth_client, {"contrast": {"set": {"ids": ["working_memory"], "descendants": False}}}
    )
    task_family = await _query(auth_client, {"task": {"ids": ["working_memory_span"]}})
    task_exact = await _query(
        auth_client, {"task": {"ids": ["working_memory_span"], "descendants": False}}
    )
    key_family = await _query(auth_client, {"contrast": {"key": "reward_and_value_choice"}})

    assert _names(family) == ["schizophrenia > control"]
    assert _rows(exact) == []
    assert _papers(task_family, papers) == [CONDUCT, SCHIZOPHRENIA]
    assert _rows(task_exact) == []
    assert _papers(key_family, papers) == [NICOTINE]


async def test_keys_and_sets_are_directional_terms(auth_client, papers):
    as_stated = await _query(auth_client, {"contrast": {"set": "working_memory#1:reversed"}})
    the_set_s_way = await _query(auth_client, {"contrast": {"set": "working_memory#1"}})
    either = await _query(
        auth_client, {"contrast": {"set": ["working_memory#1", "working_memory#1:reversed"]}}
    )
    reversed_key = await _query(
        auth_client, {"contrast": {"key": "working_memory_span|load:2|vs:load:0:reversed"}}
    )

    assert _names(as_stated) == _names(either) == ["schizophrenia > control"]
    assert _rows(the_set_s_way) == []
    assert _rows(reversed_key) == []


async def test_the_analysis_name_is_text(auth_client, papers):
    assert _names(await _query(auth_client, {"name": "BDp"})) == ["schizophrenia > BDp"]


async def test_role_narrows_medical_condition_ids(auth_client, session):
    document = af.with_roles(
        af.record(SCHIZOPHRENIA), {"MONDO:0005090": "primary", "MONDO:0004985": "comorbid"}
    )
    af.upload(SCHIZOPHRENIA, document)
    db.session.commit()
    bipolar = {"ids": ["MONDO:0004985"]}

    any_role = await _query(auth_client, {"medical_condition": bipolar})
    primary = await _query(auth_client, {"medical_condition": {**bipolar, "role": "primary"}})
    comorbid = await _query(auth_client, {"medical_condition": {**bipolar, "role": "comorbid"}})
    worded = await _query(
        auth_client,
        {"medical_condition": {"text": "bipolar", "role": "primary"}},
        status=400,
    )

    assert _names(any_role) == _names(comorbid) == ["schizophrenia > BDp"]
    assert _rows(primary) == []
    assert _codes(worded) == ["ROLE_NEEDS_IDS_ONLY"]


async def test_whole_words_and_wildcards(auth_client, papers):
    assert _rows(await _query(auth_client, {"medical_condition": "nicot"})) == []
    nicotine = await _query(
        auth_client, {"medical_condition": {"text": "nicot*", "when_unmapped": "text"}}
    )
    assert _papers(nicotine, papers) == [NICOTINE]
    assert _papers(await _query(auth_client, {"task": "n?back"}), papers) == [SCHIZOPHRENIA]


async def test_text_is_case_insensitive_and_stays_within_one_item(auth_client, papers):
    assert _names(await _query(auth_client, {"medical_condition": "Schizophrenia"})) == _names(
        await _query(auth_client, {"medical_condition": "schizophrenia"})
    )
    assert _papers(await _query(auth_client, {"task": "N?BACK"}), papers) == [SCHIZOPHRENIA]
    # "schizophrenia | bipolar disorder" holds both, but no match crosses the separator.
    across_items = await _query(auth_client, {"medical_condition": "schizophrenia*bipolar"})
    assert _rows(across_items) == []


def _codes(body):
    return [e["code"] for e in body["errors"]]


async def test_a_pattern_needs_three_letters(auth_client, papers):
    assert _codes(await _query(auth_client, {"medical_condition": "s*z"}, status=400)) == [
        "PATTERN_TOO_BROAD"
    ]
    assert _codes(await _query(auth_client, {"medical_condition": "bi*"}, status=400)) == [
        "PATTERN_TOO_BROAD"
    ]
    bipolar = await _query(auth_client, {"medical_condition": "bip*"})
    assert _papers(bipolar, papers) == [SCHIZOPHRENIA]


async def test_invalid_queries_are_refused(auth_client, papers):
    # The spec refuses unknown fields; the server refuses unknown values.
    await _query(auth_client, {"medical_conditions": "schizophrenia"}, status=400)
    await _query(auth_client, {"contrast": {"polarity": "2-back"}}, status=400)
    assert _codes(await _query(auth_client, {"spatial_scope": "whole brain"}, status=400)) == [
        "INVALID_VALUE"
    ]
    assert _codes(await _query(auth_client, {"contrast": {"kind": "bogus"}}, status=400)) == [
        "INVALID_VALUE"
    ]
    await _query(auth_client, {"or": [{"medical_condition": "schizophrenia"}]}, status=400)
    # contrast.set has ids only, and a normalized criterion needs something to match.
    await _query(auth_client, {"contrast": {"set": {"text": "2-back"}}}, status=400)
    await _query(auth_client, {"task": {"when_unmapped": "text"}}, status=400)
    await _query(auth_client, {"task": {"text": "n-back", "when_unmapped": "x"}}, status=400)
    await _query(auth_client, {"contrast": {"positive": {"bogus": True}}}, status=400)
    await _query(auth_client, {"contrast": {"positive": {}}}, status=400)


async def test_criteria_combine_with_and_and_any_all_none(auth_client, papers):
    whole_brain_wm = await _query(
        auth_client, {"task": "working memory", "spatial_scope": "whole_brain"}
    )
    not_schizophrenia = await _query(
        auth_client,
        {"medical_condition": {"none": {"text": ["schizophrenia"]}, "when_unmapped": "text"}},
    )
    both = await _query(
        auth_client, {"medical_condition": {"all": {"text": ["schizophrenia", "bipolar"]}}}
    )
    both_ids = await _query(
        auth_client,
        {"medical_condition": {"all": {"ids": ["MONDO:0005090", "MONDO:0004985"]}}},
    )

    assert _papers(whole_brain_wm, papers) == [CONDUCT]
    assert _papers(not_schizophrenia, papers) == [NICOTINE, CONDUCT]
    assert _names(both) == _names(both_ids) == ["schizophrenia > BDp"]


async def test_contrast_sides_and_sets(auth_client, papers):
    load = await _query(auth_client, {"contrast": {"positive": "2-back", "negative": "0-back"}})
    reversed_ = await _query(auth_client, {"contrast": {"positive": "0-back"}})
    by_set = await _query(auth_client, {"contrast": {"set": "working_memory#1:reversed"}})
    by_key = await _query(
        auth_client, {"contrast": {"key": "working_memory_span|load:2|vs:load:0"}}
    )
    between = await _query(auth_client, {"contrast": {"groups": "between"}})
    within = await _query(auth_client, {"contrast": {"groups": "within"}})

    assert _papers(load, papers) == [SCHIZOPHRENIA]
    assert _rows(reversed_) == []
    assert _names(by_set) == ["schizophrenia > control"]
    assert _names(by_key) == ["schizophrenia > BDp", "schizophrenia > control"]
    assert _papers(between, papers) == [NICOTINE, SCHIZOPHRENIA]
    assert _papers(within, papers) == [CONDUCT]


DEPRESSION, SOCIAL_ANXIETY = "y6qgUVcjRYtn", "myhy8yAbQrAV"


@pytest.fixture
def side_papers(papers):
    """`papers`, and the ns-pond records whose levels carry arms and timepoints."""
    for name in af.NS_POND_RECORDS:
        papers[name] = af.upload(name)["base_study_id"]
    db.session.commit()
    return papers


async def test_a_side_s_groups_say_which_cohort_is_on_it(auth_client, side_papers):
    patients_over_controls = {
        "contrast": {
            "positive": {"has_patients": True, "has_healthy": False},
            "negative": {"has_healthy": True, "has_patients": False},
        }
    }
    patients_first = await _query(auth_client, patients_over_controls, funnel=True)
    controls_first = await _query(
        auth_client,
        {"contrast": {"positive": {"has_healthy": True}, "negative": {"has_patients": True}}},
    )

    assert _names(patients_first) == [
        "Group difference: immediate–delayed",
        "Group differences between MDD and HCs",
        "schizophrenia > control",
    ]
    assert _rows(controls_first) == []
    assert patients_first["query"]["contrast"]["positive"] == {
        "has_patients": {"is": True, "when_silent": "exclude"},
        "has_healthy": {"is": False, "when_silent": "exclude"},
    }
    assert [step["criterion"] for step in patients_first["funnel"]] == [
        "contrast.positive.has_patients",
        "contrast.positive.has_healthy",
        "contrast.negative.has_patients",
        "contrast.negative.has_healthy",
    ]
    features = next(
        r["features"]
        for r in _rows(patients_first)
        if r["name"] == "Group differences between MDD and HCs"
    )
    assert features["contrast_positive_medical_condition_ids"] == [
        "MONDO:0002009",
        "ONVOC:0000207",
    ]
    assert features["contrast_negative_has_healthy"] is True


async def test_a_side_s_medical_condition_matches_that_side_s_groups_only(
    auth_client, side_papers
):
    versus_bipolar = await _query(
        auth_client,
        {
            "contrast": {
                "positive": {"medical_condition": {"ids": "MONDO:0005090"}},
                "negative": {"medical_condition": "bipolar"},
            }
        },
    )
    bipolar_first = await _query(
        auth_client, {"contrast": {"positive": {"medical_condition": "bipolar"}}}
    )
    # The whole analysis has bipolar disorder in it either way.
    either = await _query(auth_client, {"medical_condition": "bipolar"})

    assert _names(versus_bipolar) == ["schizophrenia > BDp"]
    assert _matched_by(versus_bipolar, "contrast.positive.medical_condition") == ["id"]
    assert _matched_by(versus_bipolar, "contrast.negative.medical_condition") == ["text"]
    assert _rows(bipolar_first) == []
    assert _names(either) == ["schizophrenia > BDp"]


async def test_a_side_s_timepoints_arms_and_facets(auth_client, side_papers):
    treated_after = await _query(
        auth_client,
        {
            "contrast": {
                "positive": {
                    "timepoint": "post_intervention",
                    "arm_kind": "behavioural_intervention",
                },
                "negative": {"timepoint": "pre_intervention"},
            }
        },
    )
    after = await _query(
        auth_client, {"contrast": {"positive": {"timepoint": "post_intervention"}}}
    )
    reappraisal = await _query(
        auth_client, {"contrast": {"positive": {"facet": "regulation:reappraise"}}}
    )
    high_load = await _query(
        auth_client,
        {"contrast": {"positive": {"facet": "load:2"}, "negative": {"facet": "load:0"}}},
    )
    against_a_control_state = await _query(
        auth_client, {"contrast": {"negative": {"facet": {"any": ["control_state", "rest"]}}}}
    )

    assert _names(treated_after) == ["Positive FC"]
    assert _papers(after, side_papers) == sorted([DEPRESSION, SOCIAL_ANXIETY])
    assert _names(reappraisal) == ["Inverse FC", "Positive FC"]
    assert _papers(high_load, side_papers) == [SCHIZOPHRENIA]
    assert _papers(against_a_control_state, side_papers) == [CONDUCT]


async def test_a_side_s_text_is_shorthand_for_its_name(auth_client, papers):
    shorthand = await _query(auth_client, {"contrast": {"positive": "2-back"}})
    named = await _query(
        auth_client,
        {"contrast": {"positive": {"name": "2-back", "has_patients": True}}},
    )

    assert shorthand["query"] == {
        "contrast": {"positive": {"name": {"any": ["2-back"], "when_silent": "exclude"}}}
    }
    assert _names(named) == _names(shorthand) == [
        "schizophrenia > BDp",
        "schizophrenia > control",
    ]


async def test_terms_list_each_side_s_facets(auth_client, papers):
    resp = await auth_client.get("/api/analysis-terms/?field=contrast_negative_facet")

    assert resp.status_code == 200, resp.json()
    by_value = {row["value"]: row for row in resp.json()["results"]}
    assert (by_value["load:0"]["analyses"], by_value["load:0"]["base_studies"]) == (2, 1)
    assert by_value["control_state"]["base_studies"] == 1


async def test_when_silent_decides_the_analyses_a_record_says_nothing_about(
    auth_client, papers
):
    # Only the conduct-disorder record states its timepoints (one, so not longitudinal).
    strict = await _query(auth_client, {"design": {"longitudinal": False}}, funnel=True)
    lenient = await _query(
        auth_client, {"design": {"longitudinal": {"is": False, "when_silent": "include"}}}
    )

    assert _papers(strict, papers) == [CONDUCT]
    assert strict["funnel"] == [
        {
            "criterion": "design.longitudinal",
            "analyses": 1,
            "base_studies": 1,
            "dropped": 4,
            "silent": 4,
            "unmapped": None,
        }
    ]
    assert lenient["metadata"]["analysis_count"] == 5


async def test_or_takes_sub_queries(auth_client, papers):
    result = await _query(
        auth_client,
        {"or": [{"medical_condition": "schizophrenia"}, {"task": "monetary incentive delay"}]},
    )

    assert _papers(result, papers) == [NICOTINE, SCHIZOPHRENIA]
    assert result["query"]["or"][0]["medical_condition"] == {
        "text": ["schizophrenia"],
        "descendants": True,
        "when_unmapped": "exclude",
        "when_silent": "exclude",
    }
    assert {how for r in _rows(result) for how in r["matched_by"].items()} == {
        ("or[0].medical_condition", "text"),
        ("or[1].task", "text"),
    }


async def test_the_funnel_counts_each_criterion_in_order(auth_client, papers):
    result = await _query(
        auth_client, {"spatial_scope": "whole_brain", "n": {"min": 72}}, funnel=True
    )
    timed = await _query(
        auth_client,
        {"spatial_scope": "whole_brain", "design": {"longitudinal": False}},
        funnel=True,
    )

    assert [(s["criterion"], s["analyses"], s["dropped"]) for s in result["funnel"]] == [
        ("spatial_scope", 3, 2),
        ("n", 1, 2),
    ]
    assert _papers(result, papers) == [CONDUCT]
    assert _names(await _query(auth_client, {"n": {"max": 22}})) == ["schizophrenia > BDp"]
    # Silent counts the analyses the earlier criteria left: the two whole-brain smokers.
    assert [s["silent"] for s in timed["funnel"]] == [0, 2]


async def test_analysis_columns_join_without_multiplying(auth_client, papers):
    result = await _query(auth_client, {"has_coordinates": True}, funnel=True)
    inside_or = await _query(
        auth_client, {"or": [{"has_coordinates": True}, {"role": "anchor"}]}
    )

    assert result["metadata"]["analysis_count"] == inside_or["metadata"]["analysis_count"] == 5
    assert result["searched"] == {"analyses": 5, "base_studies": 3}


async def test_none_excludes_a_silent_record_unless_it_says_include(auth_client, session):
    silent = af.record(CONDUCT)
    for group in silent["groups"]:
        group["medical_condition"] = {
            "extraction_status": "not_reported",
            "evidence": {"status": "not_found"},
        }
    af.upload(CONDUCT, silent)
    af.upload(SCHIZOPHRENIA)
    db.session.commit()

    none = {"none": {"text": ["schizophrenia"]}}
    strict = await _query(auth_client, {"medical_condition": none}, funnel=True)
    lenient = await _query(
        auth_client, {"medical_condition": {**none, "when_silent": "include"}}
    )

    assert _rows(strict) == []
    assert strict["funnel"][0]["silent"] == 1
    assert [r["name"] for r in _rows(lenient)] == ["+/- SWM (−)"]
    assert _rows(lenient)[0]["matched_by"] == {"medical_condition": "silent"}


async def test_results_are_studies_each_with_its_selected_analyses(auth_client, papers):
    every = await _query(auth_client, {"species": "human"})
    resp = await auth_client.post(
        "/api/analysis-queries/", data={"query": {"species": "human"}}
    )
    one = await _query(auth_client, {"species": "human"}, paginate=True, page_size=1)
    counts_only = await _query(auth_client, {"species": "human"}, paginate=True, page_size=0)

    assert every["metadata"] == {"total_count": 3, "analysis_count": 5}
    assert len(every["results"]) == 3 and len(_rows(every)) == 5
    assert len({s["base_study"] for s in every["results"]}) == 3
    # Paged by default, 20 studies a page: all three here.
    assert resp.json()["results"] == every["results"]
    # A page holds whole studies: the first study and every one of its analyses.
    assert one["results"] == every["results"][:1]
    assert counts_only["results"] == []
    for result in (one, counts_only):
        assert result["metadata"] == every["metadata"]


async def test_base_study_ids_restrict_the_selection_the_counts_and_the_funnel(
    auth_client, papers
):
    every = await _query(auth_client, {})
    per_paper = {}
    for r in _rows(every):
        per_paper.setdefault(r["base_study"], []).append(r["analysis"])
    smokers = papers[NICOTINE]

    theirs = await _query(auth_client, {}, base_study_ids=[smokers], funnel=True)
    whole_brain = await _query(
        auth_client,
        {"spatial_scope": "whole_brain"},
        base_study_ids=[smokers, papers[SCHIZOPHRENIA]],
        funnel=True,
    )
    everywhere = await _query(auth_client, {"spatial_scope": "whole_brain"})

    # An empty query lists every analysis the paper has features for, with them.
    assert sorted(r["analysis"] for r in _rows(theirs)) == sorted(per_paper[smokers])
    assert all(r["features"] for r in _rows(theirs))
    assert theirs["metadata"]["total_count"] == 1
    assert theirs["searched"] == {"analyses": len(per_paper[smokers]), "base_studies": 1}
    # The two whole-brain smokers, not the conduct paper's whole-brain analysis.
    assert _papers(whole_brain, papers) == [NICOTINE]
    assert (
        whole_brain["metadata"]["analysis_count"]
        == everywhere["metadata"]["analysis_count"] - 1
    )
    assert whole_brain["searched"]["base_studies"] == 2
    assert whole_brain["funnel"][0]["dropped"] == (
        len(per_paper[smokers]) + len(per_paper[papers[SCHIZOPHRENIA]])
        - whole_brain["metadata"]["analysis_count"]
    )


async def test_study_ids_restrict_too_and_combine_with_base_study_ids(auth_client, papers):
    theirs = await _query(auth_client, {}, base_study_ids=[papers[CONDUCT]])
    (study,) = _studies(theirs)

    by_study = await _query(auth_client, {}, study_ids=[study])
    both = await _query(auth_client, {}, study_ids=[study], base_study_ids=[papers[CONDUCT]])
    disjoint = await _query(
        auth_client, {}, study_ids=[study], base_study_ids=[papers[NICOTINE]]
    )
    unknown = await _query(auth_client, {}, base_study_ids=["noSuchPaper1"])

    assert _rows(by_study) == _rows(both) == _rows(theirs)
    assert _rows(disjoint) == [] and disjoint["metadata"]["analysis_count"] == 0
    assert unknown["results"] == []
    assert unknown["metadata"] == {"total_count": 0, "analysis_count": 0}


async def test_a_scope_takes_any_number_of_ids(auth_client, papers):
    filler = [f"noSuchPaper{i:06d}" for i in range(20000)]
    theirs = await _query(auth_client, {}, base_study_ids=[papers[CONDUCT]])

    wide = await _query(auth_client, {}, base_study_ids=[*filler, papers[CONDUCT]])

    assert _rows(wide) == _rows(theirs)


async def test_pages_walk_the_listing_in_order(auth_client, papers):
    every = await _query(auth_client, {})
    total = every["metadata"]["total_count"]
    pages = []
    for page in range(1, total + 2):
        listed = await _query(auth_client, {}, paginate=True, page=page, page_size=1)
        assert listed["metadata"] == every["metadata"]
        pages.append(listed["results"])

    assert [len(p) for p in pages] == [1] * total + [0]
    assert [s for p in pages for s in p] == every["results"]


async def test_detail_says_how_much_each_study_carries(auth_client, papers):
    full = await _query(auth_client, {"species": "human"}, funnel=True)
    slim = await _query(auth_client, {"species": "human"}, funnel=True, detail="analyses")
    bare = await _query(auth_client, {"species": "human"}, funnel=True, detail="studies")

    assert all("features" in r for r in _rows(full))
    assert _rows(slim) == [
        {k: v for k, v in r.items() if k != "features"} for r in _rows(full)
    ]
    assert all(r["name"] for r in _rows(slim))
    assert bare["results"] == [
        {"study": s["study"], "base_study": s["base_study"]} for s in full["results"]
    ]
    for result in (slim, bare):
        assert {k: v for k, v in result.items() if k != "results"} == {
            k: v for k, v in full.items() if k != "results"
        }
    # Paged the same way.
    page = await _query(
        auth_client, {"species": "human"}, paginate=True, page=2, page_size=1, detail="studies"
    )
    assert page["results"] == bare["results"][1:2]


async def test_invalid_scopes_pages_and_flags_are_refused(auth_client, papers):
    await _query(auth_client, {}, status=400, base_study_ids=papers[CONDUCT])
    await _query(auth_client, {}, status=400, page=0)
    await _query(auth_client, {}, status=400, page_size=-1)
    await _query(auth_client, {}, status=400, page_size=True)
    await _query(auth_client, {}, status=400, detail="everything")
    await _query(auth_client, {}, status=400, paginate="no")
    assert _codes(await _query(auth_client, {}, status=400, base_study_ids=[""])) == [
        "INVALID_VALUE"
    ]


async def test_terms_list_values_with_counts(auth_client, papers):
    resp = await auth_client.get("/api/analysis-terms/?field=medical_condition")
    found = await auth_client.get("/api/analysis-terms/?field=task&search=n_back")

    assert resp.status_code == 200
    empty = {"parent": None, "children": [], "synonyms": []}
    assert resp.json()["results"] == [
        {
            "value": "MONDO:0005090",
            "label": "schizophrenia",
            **empty,
            "analyses": 2,
            "base_studies": 1,
        },
        {
            "value": "MONDO:0004985",
            "label": "bipolar disorder",
            **empty,
            "analyses": 1,
            "base_studies": 1,
        },
    ]
    assert [r["value"] for r in found.json()["results"]] == ["hedtsk_n_back"]
    sets = await auth_client.get("/api/analysis-terms/?field=contrast_set&search=back")
    assert [(r["value"], r["label"], r["parent"]) for r in sets.json()["results"]] == [
        ("working_memory#1:reversed", "0-back > 2-back", "working_memory")
    ]
    families = await auth_client.get("/api/analysis-terms/?field=task_family")
    under = await auth_client.get("/api/analysis-terms/?field=task&parent=working_memory_span")
    keys = await auth_client.get("/api/analysis-terms/?field=contrast_key&search=load")
    assert [(r["value"], r["children"]) for r in families.json()["results"]] == [
        ("working_memory_span", ["hedtsk_n_back", "tct_self_ordered_search"]),
        ("reward_and_value_choice", ["hedtsk_monetary_incentive_delay"]),
    ]
    assert sorted(r["value"] for r in under.json()["results"]) == [
        "hedtsk_n_back",
        "tct_self_ordered_search",
    ]
    assert [(r["value"], r["analyses"]) for r in keys.json()["results"]] == [
        ("working_memory_span|load:2|vs:load:0", 2)
    ]
    by_label = await auth_client.get("/api/analysis-terms/?field=medical_condition&search=bipolar")
    scopes = await auth_client.get("/api/analysis-terms/?field=spatial_scope")
    assert [r["value"] for r in by_label.json()["results"]] == ["MONDO:0004985"]
    assert [(r["value"], r["analyses"]) for r in scopes.json()["results"]] == [
        ("whole_brain", 3),
        ("roi", 2),
    ]


async def test_a_query_becomes_a_studyset_and_an_annotation_column(auth_client, papers):
    query = {"task": "working memory"}
    result = await _query(auth_client, query)
    studyset = await auth_client.post(
        "/api/studysets/", data={"name": "working memory", "studies": _studies(result)}
    )
    assert studyset.status_code == 200
    annotation = await auth_client.post(
        "/api/annotations/",
        data={
            "studyset": studyset.json()["id"],
            "note_keys": ordered_note_keys({"included": "boolean"}),
        },
    )
    assert annotation.status_code == 200

    resp = await auth_client.put(
        f"/api/annotations/{annotation.json()['id']}",
        data={
            "analysis_query": {
                "query": {**query, "spatial_scope": "whole_brain"},
                "feature_columns": [
                    "medical_condition",
                    "task",
                    "contrast",
                    "contrast_key",
                    "n",
                ],
            }
        },
    )

    assert resp.status_code == 200, resp.json()
    body = resp.json()
    notes = {n["analysis"]: n["note"] for n in body["notes"]}
    # Both working-memory papers are in the studyset (two schizophrenia ROI analyses, one
    # conduct-disorder analysis); only the whole-brain one is included.
    assert len(notes) == 3
    included = [note for note in notes.values() if note["included"]]
    assert included == [
        {
            "included": True,
            "medical_condition": "Conduct disorder in 12 participants: 7 mild and 5 moderate",
            "task": "Self-Ordered Spatial Search (CANTAB SWM)",
            "contrast": "vigilance > SWM",
            "contrast_key": "working_memory_span|concreteness:abstract|control_state",
            "n": 72,
        }
    ]
    excluded = [note for note in notes.values() if not note["included"]]
    assert {note["task"] for note in excluded} == {"N-Back Task"}
    assert body["note_keys"]["included"]["type"] == "boolean"
    # Lists are joined into one string for Compose.
    assert {k: body["note_keys"][k]["type"] for k in ("medical_condition", "contrast_key")} == {
        "medical_condition": "string",
        "contrast_key": "string",
    }
    assert body["note_keys"]["n"]["type"] == "number"
    frozen = body["metadata"]["analysis_queries"]["included"]
    assert frozen["analysis_ids"] == sorted(a for a, note in notes.items() if note["included"])
    assert frozen["query"]["spatial_scope"] == {"any": ["whole_brain"], "when_silent": "exclude"}
    assert frozen["mapping_tools"] == ["fixture: ns-pond build rows (astra_records.json)"]
    assert "frozen_at" in frozen


async def test_the_annotation_column_is_rewritten_beside_pipeline_columns(
    auth_client, papers
):
    study_ids = _studies(await _query(auth_client, {"species": "human"}))
    # A study of the user's own, whose analysis no record describes.
    own = await auth_client.post(
        "/api/studies/", data={"name": "my study", "analyses": [{"name": "my analysis"}]}
    )
    studyset = await auth_client.post(
        "/api/studysets/", data={"name": "all", "studies": [*study_ids, own.json()["id"]]}
    )
    annotation = (
        await auth_client.post("/api/annotations/", data={"studyset": studyset.json()["id"]})
    ).json()
    url = f"/api/annotations/{annotation['id']}"

    def put(query, **extra):
        return auth_client.put(
            url,
            data={
                "analysis_query": {"query": query, "column": "picked", "feature_columns": ["n"]},
                **extra,
            },
        )

    first = (await put({"medical_condition": "schizophrenia"})).json()
    again = (
        await put(
            {"medical_condition": {"text": "nicotine", "when_unmapped": "text"}},
            pipelines=[{"name": "pondie", "columns": ["extractor_model"]}],
        )
    ).json()
    bad = await auth_client.put(
        url, data={"analysis_query": {"query": {}, "feature_columns": ["included"]}}
    )

    def picked(body):
        return sorted(n["note"]["n"] for n in body["notes"] if n["note"]["picked"])

    assert picked(first) == [22, 29]
    assert picked(again) == [71, 71]
    own_analysis = own.json()["analyses"][0]
    own_analysis = own_analysis if isinstance(own_analysis, str) else own_analysis["id"]
    mine = next(n["note"] for n in again["notes"] if n["analysis"] == own_analysis)
    assert mine["picked"] is False and mine["n"] is None
    assert {n["note"]["extractor_model"] for n in again["notes"]} == {
        "Qwen3.8-27B QLoRA (astra-distill r3-27b-final)",
        None,
    }
    assert again["note_keys"]["picked"]["type"] == "boolean"
    assert "extractor_model" in again["note_keys"]
    assert bad.status_code == 400


async def test_a_medical_condition_id_matches_its_descendants_in_the_loaded_release(
    auth_client, session, tmp_path
):
    af.load(tmp_path)
    for name in af.RECORDS:
        af.upload(name)
    db.session.commit()
    psychotic = {"ids": ["MONDO:0005487"]}

    below = await _query(auth_client, {"medical_condition": psychotic})
    exact = await _query(auth_client, {"medical_condition": {**psychotic, "descendants": False}})
    by_synonym = await _query(auth_client, {"medical_condition": "dementia praecox"})
    terms = await auth_client.get("/api/analysis-terms/?field=medical_condition&search=praecox")

    assert _names(below) == ["schizophrenia > BDp", "schizophrenia > control"]
    assert _matched_by(below, "medical_condition") == ["id"]
    assert _rows(exact) == []
    assert _names(by_synonym) == ["schizophrenia > BDp", "schizophrenia > control"]
    assert [
        (r["value"], r["label"], r["parent"], r["synonyms"]) for r in terms.json()["results"]
    ] == [("MONDO:0005090", "schizophrenia", "MONDO:0005487", ["dementia praecox"])]
