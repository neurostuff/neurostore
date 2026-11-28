import copy

import pytest
from sqlalchemy import func, select

from neurosynth_compose.models import (
    CurationCitation,
    CurationStub,
    Project,
)
from neurosynth_compose.resources.data_views.projects_view import (
    _filter_project_list_provenance,
)
from neurosynth_compose.tests.curation_fixtures import (
    irregular_provenance,
    real_provenance,
)

KEEP_ID = "9b40f12b-1ba4-4eab-a2b1-7d55d3b73e02"


@pytest.fixture
def project_id(auth_client):
    response = auth_client.post(
        "/api/projects",
        data={"name": "curation", "provenance": irregular_provenance()},
    )
    assert response.status_code == 200, response.json
    return response.json["id"]


def _get(client, project_id, **params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    response = client.get(f"/api/projects/{project_id}" + (f"?{query}" if query else ""))
    assert response.status_code == 200, response.json
    return response.json


def _stub_rows(session, project_id):
    session.expire_all()
    return {
        s.id: (s.pk, s.column_id, s.position)
        for s in session.scalars(select(CurationStub).where(CurationStub.project_id == project_id))
    }


def test_a_project_returns_the_provenance_it_was_saved_with(auth_client, project_id):
    assert _get(auth_client, project_id)["provenance"] == irregular_provenance()


def test_a_save_rewrites_only_the_stubs_that_changed(auth_client, session, project_id):
    before = _stub_rows(session, project_id)
    doc = irregular_provenance()
    first, second = doc["curationMetadata"]["columns"]
    second["stubStudies"][0]["exclusionTag"] = "neurosynth_exclude_exclusion"
    moved = first["stubStudies"].pop(4)
    second["stubStudies"].insert(0, moved)

    response = auth_client.put(f"/api/projects/{project_id}", data={"provenance": doc})

    assert response.status_code == 200
    assert response.json["provenance"] == doc
    after = _stub_rows(session, project_id)
    assert {k: v[0] for k, v in after.items()} == {k: v[0] for k, v in before.items()}
    changed = {k for k in after if after[k] != before[k]}
    assert changed == {moved["id"]}


def test_saving_bumps_updated_at(auth_client, project_id):
    first = _get(auth_client, project_id, include_provenance="false")["updated_at"]
    doc = irregular_provenance()
    doc["metaAnalysisMetadata"]["canEditMetaAnalyses"] = False

    response = auth_client.put(f"/api/projects/{project_id}", data={"provenance": doc})

    assert response.json["updated_at"] != first
    assert _get(auth_client, project_id)["updated_at"] == response.json["updated_at"]


def test_projects_share_one_citation_per_neurostore_id(auth_client, session, project_id):
    doc = real_provenance()
    stub = doc["curationMetadata"]["columns"][1]["stubStudies"][0]
    stub["title"] = "Another project's title"
    other = auth_client.post("/api/projects", data={"name": "other", "provenance": doc})

    citations = session.scalar(
        select(func.count()).select_from(CurationCitation).where(
            CurationCitation.neurostore_id == stub["neurostoreId"]
        )
    )
    assert citations == 1
    assert _get(auth_client, other.json["id"])["provenance"] == doc
    assert _get(auth_client, project_id)["provenance"] == irregular_provenance()


def test_a_tag_relabelled_on_the_project_leaves_stub_copies_as_sent(auth_client, project_id):
    doc = irregular_provenance()
    tag = doc["curationMetadata"]["infoTags"][3]
    tag["label"] = "renamed"  # the frontend does not touch stubs' copies

    response = auth_client.put(f"/api/projects/{project_id}", data={"provenance": doc})

    assert response.json["provenance"] == doc
    stub = doc["curationMetadata"]["columns"][1]["stubStudies"][0]
    assert stub["tags"][0]["label"] == "integration (datatype=all)"


def test_include_stubs_false_leaves_stub_lists_out(auth_client, project_id):
    provenance = _get(auth_client, project_id, include_stubs="false")["provenance"]

    columns = provenance["curationMetadata"]["columns"]
    assert [c["name"] for c in columns] == [
        c["name"] for c in irregular_provenance()["curationMetadata"]["columns"]
    ]
    assert all("stubStudies" not in c for c in columns)


def test_keep_stubs_saves_the_rest_and_keeps_the_stubs(auth_client, project_id):
    doc = _get(auth_client, project_id, include_stubs="false")["provenance"]
    doc["curationMetadata"]["infoTags"].append(
        {"id": "new-tag", "label": "new", "isAssignable": True, "isExclusionTag": False}
    )

    response = auth_client.put(
        f"/api/projects/{project_id}?keep_stubs=true", data={"provenance": doc}
    )

    assert response.status_code == 200
    expected = irregular_provenance()
    expected["curationMetadata"]["infoTags"].append(doc["curationMetadata"]["infoTags"][-1])
    assert _get(auth_client, project_id)["provenance"] == expected


def test_keep_stubs_refuses_to_drop_a_column_with_stubs(auth_client, project_id):
    doc = _get(auth_client, project_id, include_stubs="false")["provenance"]
    doc["curationMetadata"]["columns"].pop()

    response = auth_client.put(
        f"/api/projects/{project_id}?keep_stubs=true", data={"provenance": doc}
    )

    assert response.status_code == 409


def _changes(client, project_id, body):
    return client.post(f"/api/projects/{project_id}/curation-stubs", data=body)


def test_a_changeset_edits_stubs_as_the_document_would(auth_client, project_id):
    expected = irregular_provenance()
    first, second = expected["curationMetadata"]["columns"]
    new_stub = {**copy.deepcopy(second["stubStudies"][0]), "id": "brand-new", "title": "New"}
    # remove one stub, add one at the top of the second column, edit one, move one
    removed = first["stubStudies"].pop(3)
    second["stubStudies"].insert(0, new_stub)
    second["stubStudies"][1]["exclusionTag"] = "neurosynth_duplicate_exclusion"
    second["stubStudies"][1]["tags"] = []
    moved = first["stubStudies"].pop(0)
    second["stubStudies"].append(moved)

    response = _changes(
        auth_client,
        project_id,
        {
            "remove": [removed["id"]],
            "add": [{"stub": new_stub, "column_id": second["id"]}],
            "update": [
                {"id": KEEP_ID, "exclusionTag": "neurosynth_duplicate_exclusion", "tags": []}
            ],
            "move": [{"id": moved["id"], "column_id": second["id"], "index": -1}],
        },
    )

    assert response.status_code == 200, response.json
    assert response.json["removed"] == response.json["added"] == 1
    project = _get(auth_client, project_id)
    assert project["updated_at"] == response.json["updated_at"]
    assert project["provenance"] == expected


def test_a_changeset_moves_only_the_stub_it_names(auth_client, session, project_id):
    before = _stub_rows(session, project_id)
    second_id = irregular_provenance()["curationMetadata"]["columns"][1]["id"]

    response = _changes(
        auth_client,
        project_id,
        {"move": [{"id": "odd-tag", "column_id": second_id, "index": 1}]},
    )

    assert response.status_code == 200, response.json
    after = _stub_rows(session, project_id)
    assert {k for k in after if after[k] != before[k]} == {"odd-tag"}


def test_a_stale_changeset_is_refused(auth_client, project_id):
    seen = _get(auth_client, project_id, include_provenance="false")["updated_at"]
    auth_client.post(
        f"/api/projects/{project_id}/curation-stubs",
        data={"update": [{"id": KEEP_ID, "title": "first edit"}]},
    )

    response = _changes(
        auth_client, project_id, {"updated_at": seen, "remove": [KEEP_ID]}
    )

    assert response.status_code == 409


@pytest.mark.parametrize(
    "body, status",
    [
        ({"remove": ["no-such-stub"]}, 404),
        ({"add": [{"stub": {"id": KEEP_ID}}]}, 409),
        ({"add": [{"stub": {"title": "no id"}}]}, 422),
        ({"move": [{"id": KEEP_ID, "column_id": "no-such-column"}]}, 422),
    ],
)
def test_bad_changesets_change_nothing(auth_client, project_id, body, status):
    response = _changes(auth_client, project_id, body)

    assert response.status_code == status
    assert _get(auth_client, project_id)["provenance"] == irregular_provenance()


def test_only_the_owner_changes_stubs(auth_clients, project_id):
    response = _changes(auth_clients[1], project_id, {"remove": [KEEP_ID]})

    assert response.status_code == 403


def test_stubs_are_read_in_pages_in_board_order(auth_client, project_id):
    doc = irregular_provenance()
    board = [
        (c["id"], s) for c in doc["curationMetadata"]["columns"] for s in c["stubStudies"]
    ]

    pages = []
    for page in (1, 2, 3):
        response = auth_client.get(
            f"/api/projects/{project_id}/curation-stubs?page={page}&page_size=4"
        )
        assert response.status_code == 200
        assert response.json["metadata"]["total_count"] == len(board)
        pages += [(r["column_id"], r["stub"]) for r in response.json["results"]]

    assert pages == board


def test_stub_pages_filter_by_column(auth_client, project_id):
    second = irregular_provenance()["curationMetadata"]["columns"][1]

    response = auth_client.get(
        f"/api/projects/{project_id}/curation-stubs?column_id={second['id']}"
    )

    assert [r["stub"] for r in response.json["results"]] == second["stubStudies"]


def test_the_project_list_summarises_stubs_from_the_tables(auth_client, project_id):
    response = auth_client.get("/api/projects?page_size=50")

    [listed] = [p for p in response.json["results"] if p["id"] == project_id]
    assert listed["provenance"] == _filter_project_list_provenance(irregular_provenance())
    assert listed["provenance"]["curationMetadata"]["columns"][1]["stubStudies"][0] == {
        "exclusionTag": None,
        "tags": [{"id": "10fad876-3223-485d-894f-b4598e0471d4"}],
    }


def test_deleting_a_project_deletes_its_stubs(auth_client, session, project_id):
    response = auth_client.delete(f"/api/projects/{project_id}")

    assert response.status_code == 204

    assert not _stub_rows(session, project_id)
    assert session.get(Project, project_id) is None


def test_the_summary_counts_stubs_exclusions_and_tags(auth_client, project_id):
    doc = irregular_provenance()

    response = auth_client.get(f"/api/projects/{project_id}/curation-summary")

    assert response.status_code == 200
    expected = []
    for column in doc["curationMetadata"]["columns"]:
        stubs = [s for s in column["stubStudies"] if isinstance(s, dict)]
        exclusions, tags = {}, {}
        for stub in stubs:
            excluded = stub.get("exclusionTag")
            excluded = excluded.get("id") if isinstance(excluded, dict) else excluded
            if excluded:
                exclusions[excluded] = exclusions.get(excluded, 0) + 1
            for tag_id in {t["id"] for t in stub.get("tags", [])}:
                tags[tag_id] = tags.get(tag_id, 0) + 1
        expected.append({
            "id": column["id"],
            "name": column["name"],
            "stub_count": len(column["stubStudies"]),
            "exclusions": exclusions,
            "tags": tags,
        })
    assert response.json["columns"] == expected


TAGGED_ID = "10fad876-3223-485d-894f-b4598e0471d4"


def test_keep_stubs_dropping_a_tag_keeps_the_stubs_copies(auth_client, project_id):
    doc = _get(auth_client, project_id, include_stubs="false")["provenance"]
    info = doc["curationMetadata"]["infoTags"]
    doc["curationMetadata"]["infoTags"] = [t for t in info if t["id"] != TAGGED_ID]
    doc["curationMetadata"]["identificationSources"] = []

    response = auth_client.put(
        f"/api/projects/{project_id}?keep_stubs=true", data={"provenance": doc}
    )

    assert response.status_code == 200
    expected = irregular_provenance()
    expected["curationMetadata"]["infoTags"] = doc["curationMetadata"]["infoTags"]
    expected["curationMetadata"]["identificationSources"] = []
    assert _get(auth_client, project_id)["provenance"] == expected
    assert auth_client.get("/api/projects").status_code == 200


def test_a_relabelled_tag_then_a_full_save_returns_what_was_sent(auth_client, project_id):
    doc = _get(auth_client, project_id, include_stubs="false")["provenance"]
    tag = next(t for t in doc["curationMetadata"]["infoTags"] if t["id"] == TAGGED_ID)
    tag["label"] = "B"
    auth_client.put(f"/api/projects/{project_id}?keep_stubs=true", data={"provenance": doc})
    full = irregular_provenance()
    next(t for t in full["curationMetadata"]["infoTags"] if t["id"] == TAGGED_ID)["label"] = "B"

    response = auth_client.put(f"/api/projects/{project_id}", data={"provenance": full})

    assert response.status_code == 200
    assert _get(auth_client, project_id)["provenance"] == full


def test_a_stub_with_an_empty_neurostore_id_saves(auth_client, project_id):
    doc = irregular_provenance()
    doc["curationMetadata"]["columns"][1]["stubStudies"][0]["neurostoreId"] = ""

    response = auth_client.put(f"/api/projects/{project_id}", data={"provenance": doc})

    assert response.status_code == 200
    assert _get(auth_client, project_id)["provenance"] == doc


def test_a_nul_character_is_refused_with_422(auth_client, project_id):
    doc = irregular_provenance()
    doc["curationMetadata"]["columns"][1]["stubStudies"][0]["title"] = "a\x00b"

    response = auth_client.put(f"/api/projects/{project_id}", data={"provenance": doc})

    assert response.status_code == 422
    assert _get(auth_client, project_id)["provenance"] == irregular_provenance()


def test_removing_and_adding_a_new_id_in_one_changeset(auth_client, project_id):
    response = _changes(
        auth_client, project_id, {"remove": ["n1"], "add": [{"stub": {"id": "n1"}}]}
    )

    assert response.status_code == 200, response.json


def test_a_column_without_a_stub_list_takes_no_stubs(auth_client, project_id):
    doc = irregular_provenance()
    del doc["curationMetadata"]["columns"][1]["stubStudies"]
    auth_client.put(f"/api/projects/{project_id}", data={"provenance": doc})
    column_id = doc["curationMetadata"]["columns"][1]["id"]

    response = _changes(
        auth_client, project_id, {"add": [{"stub": {"id": "n2"}, "column_id": column_id}]}
    )

    assert response.status_code == 422
    assert _get(auth_client, project_id)["provenance"] == doc
