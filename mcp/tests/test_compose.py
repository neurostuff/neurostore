"""Compose tools, against recorded production responses."""

import pytest

from conftest import call

pytestmark = pytest.mark.vcr


async def test_search_and_get_project(client):
    found = await call(client, "search_projects", search="speech", page_size=3)
    assert found["total"] >= len(found["results"]) > 0
    ids = [p["id"] for p in found["results"]]
    assert "E9U9DFRDYmWB" in ids

    project = await call(client, "get_project", project_id="E9U9DFRDYmWB")
    assert project["name"] == "Speech Perception"
    assert project["meta_analysis_ids"] == ["PdFgYTpH7sJj"]
    assert project["neurostore_studyset_id"] == "usv7vUoCDb5s"
    assert "provenance" not in project


async def test_get_meta_analysis(client):
    out = await call(client, "get_meta_analysis", meta_analysis_id="PdFgYTpH7sJj")
    spec = out["specification"]
    assert spec["type"] == "CBMA"
    assert spec["estimator"]["type"] == "ALE"
    assert spec["corrector"]["type"] == "FDRCorrector"
    assert out["result_ids"] == ["EG6N9vUcHmGz", "wo2hbmjx38oW"]
    assert out["neurostore_studyset_id"] == "usv7vUoCDb5s"
    # The key that authorizes running the meta-analysis is never passed on.
    assert "run_key" not in out


async def test_get_meta_analysis_result(client):
    out = await call(client, "get_meta_analysis_result", result_id="wo2hbmjx38oW")
    assert out["meta_analysis_id"] == "PdFgYTpH7sJj"
    assert out["neurovault_collection_id"] == "25206"
    assert "Z map" in {m["map_type"] for m in out["maps"]}
    assert all(m["url"].startswith("https://neurovault.org/api/images/") for m in out["maps"])
    assert "ALE" in out["method_description"]
    assert "diagnostic_table" not in out and out["diagnostic_table_chars"] > 1000

    with_table = await call(
        client, "get_meta_analysis_result", result_id="wo2hbmjx38oW", diagnostic_chars=500
    )
    assert len(with_table["diagnostic_table"]) <= 501
