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
    resp = await client.post("/api/analysis-queries/", data={"query": query, **body})
    assert resp.status_code == status, resp.json()
    return resp.json()


def _names(result):
    return sorted(r["name"] for r in result["results"])


def _papers(result, papers):
    by_id = {v: k for k, v in papers.items()}
    return sorted({by_id[r["base_study"]] for r in result["results"]})


def _matched_by(result, criterion):
    return sorted({r["matched_by"].get(criterion) for r in result["results"]}, key=str)


async def test_medical_condition_matches_by_text_or_by_id(auth_client, papers):
    by_text = await _query(auth_client, {"medical_condition": "schizophrenia"}, funnel=True)
    by_id = await _query(auth_client, {"medical_condition": {"ids": ["MONDO:0004985"]}})
    # An id is not read as text: no record's wording says "MONDO".
    as_text = await _query(auth_client, {"medical_condition": "MONDO:0004985"})
    either = await _query(
        auth_client, {"medical_condition": {"ids": "MONDO:0004985", "text": "nicotine*"}}
    )

    assert _names(by_text) == ["schizophrenia > BDp", "schizophrenia > control"]
    assert _names(by_id) == ["schizophrenia > BDp"]
    assert as_text["results"] == []
    assert _papers(either, papers) == [NICOTINE, SCHIZOPHRENIA]
    assert _matched_by(by_text, "medical_condition") == ["text"]
    assert _matched_by(by_id, "medical_condition") == ["id"]
    assert _matched_by(either, "medical_condition") == ["id", "text"]
    assert by_text["counts"] == {"analyses": 2, "studies": 1, "base_studies": 1}
    assert by_text["searched"] == {"analyses": 5, "base_studies": 3}
    assert "funnel" not in by_id and "searched" not in by_id


async def test_when_unmapped_decides_the_analyses_whose_wording_mapped_to_nothing(
    auth_client, papers
):
    # Nicotine dependence and conduct disorder are stated and map to no MONDO term.
    by_wording = await _query(auth_client, {"medical_condition": "nicotine*"})
    mapped_only = await _query(
        auth_client, {"medical_condition": {"text": "nicotine*", "when_unmapped": "exclude"}}
    )
    unmapped_in = await _query(
        auth_client,
        {"medical_condition": {"ids": ["MONDO:0005090"], "when_unmapped": "include"}},
        funnel=True,
    )

    assert _papers(by_wording, papers) == [NICOTINE]
    assert mapped_only["results"] == []
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

    assert by_ids["results"] == []
    assert _papers(included, papers) == [NICOTINE, CONDUCT]
    assert _matched_by(included, "medical_condition") == ["unmapped"]


async def test_an_unmapped_contrast_set_is_excluded_unless_included(auth_client, session):
    document = af.record(SCHIZOPHRENIA)
    for analysis in document["analyses"]:
        if analysis["name"]["value"] == "schizophrenia > BDp":
            for entry in analysis["name"]["normalized"]:
                entry.update(status="unmapped", value=None)
    af.upload(SCHIZOPHRENIA, document)
    db.session.commit()

    bare = await _query(auth_client, {"contrast": {"set": "working_memory_span"}})
    included = await _query(
        auth_client,
        {"contrast": {"set": {"ids": "working_memory_span", "when_unmapped": "include"}}},
    )

    assert _names(bare) == ["schizophrenia > control"]
    assert bare["query"]["contrast"]["set"]["when_unmapped"] == "exclude"
    assert _names(included) == ["schizophrenia > BDp", "schizophrenia > control"]
    assert _matched_by(included, "contrast.set") == ["id", "unmapped"]


async def test_an_id_matches_its_descendants_unless_told_not_to(auth_client, papers):
    family = await _query(auth_client, {"contrast": {"set": "working_memory"}})
    exact = await _query(
        auth_client, {"contrast": {"set": {"ids": ["working_memory"], "descendants": False}}}
    )
    task_family = await _query(auth_client, {"task": {"ids": ["working_memory_span"]}})

    assert _names(family) == ["schizophrenia > control"]
    assert exact["results"] == []
    assert _papers(task_family, papers) == [CONDUCT, SCHIZOPHRENIA]


async def test_whole_words_and_wildcards(auth_client, papers):
    assert (await _query(auth_client, {"medical_condition": "nicot"}))["results"] == []
    nicotine = await _query(auth_client, {"medical_condition": "nicot*"})
    assert _papers(nicotine, papers) == [NICOTINE]
    assert _papers(await _query(auth_client, {"task": "n?back"}), papers) == [SCHIZOPHRENIA]


async def test_text_is_case_insensitive_and_stays_within_one_item(auth_client, papers):
    assert _names(await _query(auth_client, {"medical_condition": "Schizophrenia"})) == _names(
        await _query(auth_client, {"medical_condition": "schizophrenia"})
    )
    assert _papers(await _query(auth_client, {"task": "N?BACK"}), papers) == [SCHIZOPHRENIA]
    # "schizophrenia | bipolar disorder" holds both, but no match crosses the separator.
    across_items = await _query(auth_client, {"medical_condition": "schizophrenia*bipolar"})
    assert across_items["results"] == []


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
    await _query(auth_client, {"species": "human"}, status=400, limit=1001)


async def test_criteria_combine_with_and_and_any_all_none(auth_client, papers):
    whole_brain_wm = await _query(
        auth_client, {"task": "working memory", "spatial_scope": "whole_brain"}
    )
    not_schizophrenia = await _query(
        auth_client, {"medical_condition": {"none": {"text": ["schizophrenia"]}}}
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
    by_set = await _query(auth_client, {"contrast": {"set": "working_memory#1"}})
    by_key = await _query(
        auth_client, {"contrast": {"set": "working_memory_span|load:2|vs:load:0"}}
    )
    between = await _query(auth_client, {"contrast": {"groups": "between"}})
    within = await _query(auth_client, {"contrast": {"groups": "within"}})

    assert _papers(load, papers) == [SCHIZOPHRENIA]
    assert reversed_["results"] == []
    assert _names(by_set) == ["schizophrenia > control"]
    assert _names(by_key) == ["schizophrenia > BDp", "schizophrenia > control"]
    assert _papers(between, papers) == [NICOTINE, SCHIZOPHRENIA]
    assert _papers(within, papers) == [CONDUCT]


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
    assert lenient["counts"]["analyses"] == 5


async def test_or_takes_sub_queries(auth_client, papers):
    result = await _query(
        auth_client,
        {"or": [{"medical_condition": "schizophrenia"}, {"task": "monetary incentive delay"}]},
    )

    assert _papers(result, papers) == [NICOTINE, SCHIZOPHRENIA]
    assert result["query"]["or"][0]["medical_condition"] == {
        "text": ["schizophrenia"],
        "descendants": True,
        "when_unmapped": "text",
        "when_silent": "exclude",
    }
    assert {how for r in result["results"] for how in r["matched_by"].items()} == {
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

    assert result["counts"]["analyses"] == inside_or["counts"]["analyses"] == 5
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

    assert strict["results"] == []
    assert strict["funnel"][0]["silent"] == 1
    assert [r["name"] for r in lenient["results"]] == ["+/- SWM (−)"]
    assert lenient["results"][0]["matched_by"] == {"medical_condition": "silent"}


async def test_limit_caps_the_results_not_the_counts(auth_client, papers):
    result = await _query(auth_client, {"species": "human"}, limit=1)

    assert len(result["results"]) == 1
    assert result["counts"]["analyses"] == 5
    assert len(result["study_ids"]) == 3


async def test_terms_list_values_with_counts(auth_client, papers):
    resp = await auth_client.get("/api/analysis-terms/?field=medical_condition")
    found = await auth_client.get("/api/analysis-terms/?field=task&search=n_back")

    assert resp.status_code == 200
    assert resp.json()["results"] == [
        {"value": "MONDO:0005090", "label": "schizophrenia", "analyses": 2, "base_studies": 1},
        {"value": "MONDO:0004985", "label": "bipolar disorder", "analyses": 1, "base_studies": 1},
    ]
    assert [r["value"] for r in found.json()["results"]] == ["hedtsk_n_back"]
    sets = await auth_client.get("/api/analysis-terms/?field=contrast_set&search=back")
    assert [(r["value"], r["label"]) for r in sets.json()["results"]] == [
        ("working_memory#1", "2-back > 0-back")
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
        "/api/studysets/", data={"name": "working memory", "studies": result["study_ids"]}
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
                "feature_columns": ["medical_condition", "task", "contrast", "n"],
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
            "n": 72,
        }
    ]
    excluded = [note for note in notes.values() if not note["included"]]
    assert {note["task"] for note in excluded} == {"N-Back Task"}
    assert body["note_keys"]["included"]["type"] == "boolean"
    assert body["note_keys"]["n"]["type"] == "number"


async def test_the_annotation_column_is_rewritten_beside_pipeline_columns(
    auth_client, papers
):
    study_ids = (await _query(auth_client, {"species": "human"}))["study_ids"]
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
            {"medical_condition": "nicotine"},
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
