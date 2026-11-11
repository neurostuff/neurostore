"""Neurostore tools, against recorded production responses."""

import json

import pytest
from fastmcp.exceptions import ToolError

from conftest import call

pytestmark = pytest.mark.vcr


async def test_search_base_studies_pages_and_projects(client):
    out = await call(
        client, "search_base_studies", search="working memory", data_type="coordinate", page_size=5
    )
    assert out["total"] > 5
    assert out["page"] == 1 and out["next_page"] == 2
    assert len(out["results"]) == 5
    first = out["results"][0]
    assert first["id"] and first["name"] and first["study_ids"]
    assert all(r["has_coordinates"] for r in out["results"])
    # Abstracts are cut to the default 300 characters, and the raw records' bulk is gone.
    assert all(len(r.get("abstract", "")) <= 301 for r in out["results"])
    assert "metadata" not in first and "features" not in first
    assert len(json.dumps(out)) < 6000


async def test_search_base_studies_by_sphere(client):
    out = await call(
        client, "search_base_studies", x=-44, y=20, z=30, radius=6, page_size=3, abstract_chars=0
    )
    assert out["total"] > 0
    assert all("abstract" not in r for r in out["results"])


async def test_get_base_study_lists_versions(client):
    out = await call(client, "get_base_study", base_study_id="cTgsCR4mf54E")
    assert out["pmid"] == "11506538"
    assert out["journal"] == "NeuroImage"
    assert [s["id"] for s in out["studies"]] == ["6NNqviMdKeVi"]
    assert out["studies"][0]["n_analyses"] > 0


async def test_search_studies_by_pmid(client):
    out = await call(client, "search_studies", pmid="11506538")
    assert out["total"] == 1 and out["next_page"] is None
    assert out["results"][0]["id"] == "6NNqviMdKeVi"


async def test_get_study_analyses_and_points(client):
    out = await call(client, "get_study", study_id="6NNqviMdKeVi")
    analyses = out["analyses"]
    assert len(analyses) == 12
    first = analyses[0]
    assert first["name"].startswith("Odor Working Memory")
    assert first["metadata"] == {"subjects": 12}
    assert first["n_points"] == len(first["points"]) == 42
    # The analysis's one space is hoisted out of its points.
    assert first["space"] == "TAL"
    assert first["points"][0] == {"xyz": [-29.0, 48.16, 12.7]}


async def test_get_study_truncates_points(client):
    out = await call(client, "get_study", study_id="6NNqviMdKeVi", max_points_per_analysis=2)
    first = out["analyses"][0]
    assert first["n_points"] == 42
    assert len(first["points"]) == 2
    assert first["points_truncated"] is True
    assert len(json.dumps(out)) < 8000


async def test_get_study_not_found(client):
    with pytest.raises(ToolError, match="Not found"):
        await call(client, "get_study", study_id="doesNotExist1")


async def test_query_analyses_with_funnel(client):
    out = await call(
        client,
        "query_analyses",
        query={"task": {"text": "n-back"}, "species": "human"},
        funnel=True,
        page_size=3,
    )
    assert out["total"] > 3 and out["analysis_count"] >= out["total"]
    assert len(out["results"]) == 3
    assert [step["criterion"] for step in out["funnel"]] == ["species", "task"]
    assert out["searched"]["analyses"] > out["funnel"][-1]["analyses"]
    # `analyses` detail: ids, names and matches, no features.
    analysis = out["results"][0]["analyses"][0]
    assert analysis["matched_by"] == {"task": "text"}
    assert "features" not in analysis


async def test_query_analyses_restricted_to_papers(client):
    # An empty query restricted to one paper lists all its analyses' features.
    out = await call(
        client, "query_analyses", query={}, base_study_ids=["277L754xor6d"], detail="features"
    )
    assert out["total"] == 1
    assert {r["base_study"] for r in out["results"]} == {"277L754xor6d"}
    analyses = out["results"][0]["analyses"]
    assert analyses and all("features" in a for a in analyses)


async def test_query_analyses_caps_feature_pages(client):
    out = await call(
        client,
        "query_analyses",
        query={"task": {"text": "stroop"}},
        detail="features",
        page_size=50,
    )
    assert out["page_size"] == 20
    assert len(out["results"]) == 20


async def test_query_analyses_reports_api_validation(client):
    with pytest.raises(ToolError, match="PATTERN_TOO_BROAD"):
        await call(client, "query_analyses", query={"task": {"text": "nb"}})


async def test_list_analysis_terms(client):
    out = await call(client, "list_analysis_terms", field="task", search="stroop", limit=5)
    values = [r["value"] for r in out["results"]]
    assert "hedtsk_stroop_color_word" in values
    assert all(r["analyses"] > 0 for r in out["results"])


async def test_public_query(client):
    datasets = await call(client, "list_public_datasets")
    names = [d["name"] for d in datasets["datasets"]]
    assert "base-studies" in names
    base = next(d for d in datasets["datasets"] if d["name"] == "base-studies")
    assert base["columns"]["year"] == "integer"

    out = await call(
        client,
        "run_public_query",
        dataset="base-studies",
        select="year, count(*) AS n",
        where="year >= 2020",
        group="year",
        order="year",
    )
    assert [c["name"] for c in out["columns"]] == ["year", "n"]
    years = [row[0] for row in out["rows"]]
    assert years == sorted(years) and years[0] == 2020


async def test_studyset_and_annotations(client):
    studyset = await call(client, "get_studyset", studyset_id="ewtEqjidaJbH", page_size=4)
    assert studyset["study_ids"]["total"] == 9
    assert len(studyset["study_ids"]["results"]) == 4
    assert studyset["study_ids"]["next_page"] == 2

    listed = await call(client, "list_annotations", studyset_id="ewtEqjidaJbH")
    assert [a["id"] for a in listed["results"]] == ["WrGg7oA9QiZB"]
    assert listed["results"][0]["n_notes"] > 5

    annotation = await call(
        client, "get_annotation", annotation_id="WrGg7oA9QiZB", page=2, page_size=5
    )
    assert annotation["note_keys"] == {
        "included": {"type": "boolean", "order": 0, "default": True}
    }
    notes = annotation["notes"]
    assert notes["page"] == 2 and len(notes["results"]) == 5
    assert notes["total"] == listed["results"][0]["n_notes"]
    assert set(notes["results"][0]) >= {"analysis_id", "study_id", "note"}
