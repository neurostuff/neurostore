"""The study_schema JSON Schemas the review app reads, served by /review/schemas/{name}, and the
front end's test copy of them.

Regenerate the copy with:
UPDATE_GOLDEN=1 python -m pytest neurostore/tests/review/test_schemas.py
"""

import json
import os

import pytest
from study_schema.jsonschema import load, references

from neurostore.review.schemas import strip_descriptions
from neurostore.tests.review import golden
from neurostore.tests.review.layouts import OTHER, REVIEWER, assert_matches_spec

pytestmark = pytest.mark.anyio

NAMES = ["extraction-record", "coordinate-parse"]
GOLDEN = golden.ROOT / "review-frontend/src/test/golden/schemas"
REFERENCES = golden.ROOT / "review-frontend/src/contract/references.fixture.json"
REGENERATE = (
    "regenerate it with: cd store/backend && UPDATE_GOLDEN=1 python -m "
    "pytest neurostore/tests/review/test_schemas.py"
)


def path(name):
    return f"/api/review/schemas/{name}"


def test_strip_descriptions_drops_any_depth_and_keeps_a_property_named_description():
    value = {
        "description": "top",
        "properties": {"description": {"type": "string", "description": "nested"}},
        "items": [{"description": "in a list"}],
    }

    assert strip_descriptions(value) == {
        "properties": {"description": {"type": "string"}},
        "items": [{}],
    }


@pytest.mark.parametrize("name", NAMES)
async def test_a_schema_is_study_schemas_packaged_schema_without_its_descriptions(clients, name):
    response = await clients[REVIEWER].get(path(name))

    assert response.status_code == 200
    assert response.json() == strip_descriptions(load(name))
    assert_matches_spec(response, "/review/schemas/{name}", "get")


async def test_the_served_schema_keeps_a_property_named_description(clients):
    served = (await clients[REVIEWER].get(path("extraction-record"))).json()
    described = [
        cls for cls, definition in load("extraction-record")["$defs"].items()
        if "description" in definition.get("properties", {})
    ]
    assert described
    for cls in described:
        assert "description" in served["$defs"][cls]["properties"], cls


@pytest.mark.parametrize("name", NAMES)
async def test_a_schema_carries_an_etag_and_a_cache_policy(clients, name):
    first = await clients[REVIEWER].get(path(name))
    again = await clients[OTHER].get(path(name))

    etag = first.headers["etag"]
    assert etag.startswith('"') and etag.endswith('"')
    assert again.headers["etag"] == etag
    assert "private" in first.headers["cache-control"]


async def test_the_two_schemas_have_different_etags(clients):
    tags = {(await clients[REVIEWER].get(path(name))).headers["etag"] for name in NAMES}
    assert len(tags) == len(NAMES)


@pytest.mark.parametrize("name", NAMES)
async def test_a_matching_if_none_match_is_not_modified(clients, name):
    etag = (await clients[REVIEWER].get(path(name))).headers["etag"]

    response = await clients[REVIEWER].get(path(name), headers={"If-None-Match": etag})

    assert response.status_code == 304
    assert response.content == b""
    assert response.headers["etag"] == etag


async def test_a_stale_if_none_match_gets_the_schema(clients):
    response = await clients[REVIEWER].get(
        path("extraction-record"), headers={"If-None-Match": '"stale"'}
    )
    assert response.status_code == 200
    assert response.json() == strip_descriptions(load("extraction-record"))


@pytest.mark.parametrize("name", ["storage-study", "parsed-paper", "nope"])
async def test_an_unknown_schema_is_not_found(clients, name):
    response = await clients[REVIEWER].get(path(name))

    assert response.status_code == 404
    assert response.json()["status"] == 404
    assert_matches_spec(response, "/review/schemas/{name}", "get")


async def test_a_schema_needs_a_token(clients):
    response = await clients[None].get(path("extraction-record"))

    assert response.status_code == 401
    assert_matches_spec(response, "/review/schemas/{name}", "get")


async def test_a_schema_needs_the_admin_reviewer_role(clients, make_user):
    make_user(OTHER, "admin")
    for user_id in (OTHER, "newuser-id"):
        response = await clients[user_id].get(path("extraction-record"))
        assert response.status_code == 403, user_id
        assert_matches_spec(response, "/review/schemas/{name}", "get")


@pytest.mark.parametrize("name", NAMES)
async def test_the_front_ends_copy_is_the_served_schema(clients, name):
    served = (await clients[REVIEWER].get(path(name))).json()
    rendered = json.dumps(served, indent=2, ensure_ascii=False) + "\n"
    copy = GOLDEN / f"{name}.schema.json"
    if os.environ.get("UPDATE_GOLDEN") == "1":
        GOLDEN.mkdir(parents=True, exist_ok=True)
        copy.write_text(rendered, encoding="utf-8")
    assert copy.exists(), f"{copy} is missing; {REGENERATE}"
    assert copy.read_text("utf-8") == rendered, f"{copy.name} is stale; {REGENERATE}"


def test_the_front_end_has_no_other_schema_copy():
    copies = sorted(p.name for p in GOLDEN.glob("*")) if GOLDEN.exists() else []
    assert copies == sorted(
        f"{name}.schema.json" for name in NAMES
    )
    contract = golden.ROOT / "review-frontend/src/contract"
    assert not list(contract.glob("*.schema.json"))
    assert not (golden.ROOT / "review-frontend/scripts/sync-schemas.mjs").exists()


def test_the_front_ends_reference_fixture_is_study_schemas_references():
    rows = [
        {"class": row.cls, "slot": row.slot, "target": row.target, "multivalued": row.multivalued}
        for row in references("extraction-record")
    ]
    rendered = json.dumps(rows, indent=2) + "\n"
    if os.environ.get("UPDATE_GOLDEN") == "1":
        REFERENCES.write_text(rendered, encoding="utf-8")
    assert REFERENCES.read_text("utf-8") == rendered, f"{REFERENCES.name} is stale; {REGENERATE}"
