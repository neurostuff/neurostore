import random
import string
from neurostore.models import Studyset, Study, StudysetStudy


def test_post_and_get_studysets(auth_client, ingest_neurosynth, session):
    # create a studyset
    payload = auth_client.get("/api/studies/").json()
    study_ids = [study["id"] for study in payload["results"]]
    post_data = {
        "name": "rock road",
        "description": "mah ice cram",
        "studies": study_ids,
    }
    post_resp = auth_client.post("/api/studysets/", data=post_data)
    assert post_resp.status_code == 200

    get_resp = auth_client.get(f"/api/studysets/{post_resp.json()['id']}")

    assert (
        set(get_resp.json()["studies"])
        == set(post_resp.json()["studies"])
        == set(study_ids)
    )


# @add_event_listeners
def test_add_many_studies_to_studyset(auth_client, ingest_neurosynth, session):
    existing_studies = Study.query.all()
    existing_study_ids = [s.id for s in existing_studies]

    # Function to generate a random DOI
    def generate_doi():
        doi = "10." + "".join(random.choices(string.digits, k=4)) + "/"
        doi += "".join(random.choices(string.ascii_lowercase, k=4)) + "."
        doi += "".join(random.choices(string.ascii_lowercase, k=4))
        return doi

    # List comprehension to generate the desired structure
    made_up_studies = [
        {
            "pmid": str(random.randint(100000, 999999)),
            "doi": generate_doi(),
            "name": "".join(random.choices(string.ascii_letters, k=10)),
        }
        for _ in range(100)
    ]
    # create empty studyset
    ss = auth_client.post("/api/studysets/", data={"name": "mixed_studyset"})

    assert ss.status_code == 200

    ss_id = ss.json()["id"]

    # combine made_up and created studies
    all_studies = existing_study_ids + made_up_studies

    ss_update = auth_client.put(
        f"/api/studysets/{ss_id}", data={"studies": all_studies}
    )

    assert ss_update.status_code == 200


def test_add_study_to_studyset(auth_client, ingest_neurosynth, session):
    payload = auth_client.get("/api/studies/").json()
    study_ids = [study["id"] for study in payload["results"]]
    post_data = {
        "name": "rock road",
        "description": "mah ice cram",
        "studies": study_ids[:-1],
    }
    post_resp = auth_client.post("/api/studysets/", data=post_data)
    assert post_resp.status_code == 200

    dset_id = post_resp.json()["id"]
    pre_nested = auth_client.get(f"/api/studysets/{dset_id}?nested=true")
    pre_non_nested = auth_client.get(f"/api/studysets/{dset_id}?nested=false")

    assert pre_nested.status_code == pre_non_nested.status_code == 200
    put_resp = auth_client.put(f"/api/studysets/{dset_id}", data={"studies": study_ids})

    assert put_resp.status_code == 200
    # test that the study shows up for both nested and not nested
    nested_resp = auth_client.get(f"/api/studysets/{dset_id}?nested=true")
    non_nested_resp = auth_client.get(f"/api/studysets/{dset_id}?nested=false")

    assert nested_resp.status_code == non_nested_resp.status_code == 200

    assert len(nested_resp.json()["studies"]) == len(non_nested_resp.json()["studies"])


def test_get_nested_nonnested_studysets(auth_client, ingest_neurosynth, session):
    studyset_id = Studyset.query.first().id
    non_nested = auth_client.get(f"/api/studysets/{studyset_id}?nested=false")
    nested = auth_client.get(f"/api/studysets/{studyset_id}?nested=true")

    assert isinstance(non_nested.json()["studies"][0], str)
    assert isinstance(nested.json()["studies"][0], dict)


def test_hot_swap_study_in_studyset(auth_client, ingest_neurosynth, session):
    # create studyset
    create_ss = auth_client.post("/api/studysets/", data={"name": "test"})

    assert create_ss.status_code == 200
    ss_test = create_ss.json()["id"]
    # cache studyset endpoint
    auth_client.get(f"/api/studysets/{ss_test}")
    auth_client.get(f"/api/studysets/{ss_test}?nested=false")
    auth_client.get(f"/api/studysets/{ss_test}?nested=true")
    # get study
    studies = Study.query.all()[0:2]
    study_ids = [s.id for s in studies]
    put_resp = auth_client.put(f"/api/studysets/{ss_test}", data={"studies": study_ids})
    assert put_resp.status_code == 200

    # test if cache is updated
    add_study = auth_client.get(f"/api/studysets/{ss_test}")
    add_study_non_nested = auth_client.get(f"/api/studysets/{ss_test}?nested=false")
    add_study_nested = auth_client.get(f"/api/studysets/{ss_test}?nested=true")

    assert (
        set(study_ids)
        == set([s for s in add_study.json()["studies"]])
        == set([s for s in add_study_non_nested.json()["studies"]])
        == set([s["id"] for s in add_study_nested.json()["studies"]])
    )

    # clone study
    clone_study = auth_client.post(f"/api/studies/?source_id={study_ids[0]}", data={})
    assert clone_study.status_code == 200

    clone_study_id = clone_study.json()["id"]
    new_study_ids = [clone_study_id, study_ids[1]]
    # swap out cloned study
    put_resp = auth_client.put(
        f"/api/studysets/{ss_test}", data={"studies": new_study_ids}
    )

    clone_ss = auth_client.get(f"/api/studysets/{ss_test}")
    clone_ss_nested = auth_client.get(f"/api/studysets/{ss_test}?nested=true")
    clone_ss_non_nested = auth_client.get(f"/api/studysets/{ss_test}?nested=false")

    assert (
        set(new_study_ids)
        == set(s for s in clone_ss.json()["studies"])
        == set(s for s in clone_ss_non_nested.json()["studies"])
        == set(s["id"] for s in clone_ss_nested.json()["studies"])
    )


def _create_studyset_with_annotation(auth_client, study_ids, name="clone-source"):
    studyset_resp = auth_client.post(
        "/api/studysets/",
        data={
            "name": name,
            "description": "clone me",
            "studies": study_ids,
        },
    )
    assert studyset_resp.status_code == 200
    studyset_id = studyset_resp.json()["id"]

    annotation_payload = {
        "studyset": studyset_id,
        "note_keys": {"include": {"type": "boolean", "order": 0}},
        "name": "annotation for clone",
    }
    annotation_resp = auth_client.post("/api/annotations/", data=annotation_payload)
    assert annotation_resp.status_code == 200

    annotations = auth_client.get(f"/api/annotations/?studyset_id={studyset_id}")
    assert annotations.status_code == 200
    assert len(annotations.json()["results"]) >= 1

    return studyset_resp.json(), annotations.json()["results"]


def _study_ids_from_payload(studies):
    ids = []
    for entry in studies:
        if isinstance(entry, dict):
            ids.append(entry.get("id"))
        else:
            ids.append(entry)
    return ids


def test_clone_studyset_copies_annotations_by_default(
    auth_client, ingest_neurosynth, session
):
    studies_payload = auth_client.get("/api/studies/?page_size=2")
    study_ids = [study["id"] for study in studies_payload.json()["results"]]

    source_studyset, source_annotations = _create_studyset_with_annotation(
        auth_client, study_ids
    )

    clone_resp = auth_client.post(
        f"/api/studysets/?source_id={source_studyset['id']}", data={}
    )

    assert clone_resp.status_code == 200
    clone_data = clone_resp.json()

    assert clone_data["source"] == "neurostore"
    assert clone_data["source_id"] == source_studyset["id"]
    assert set(_study_ids_from_payload(clone_data["studies"])) == set(
        _study_ids_from_payload(source_studyset["studies"])
    )
    assert clone_data["user"] == auth_client.username

    cloned_annotations = auth_client.get(
        f"/api/annotations/?studyset_id={clone_data['id']}"
    )
    assert cloned_annotations.status_code == 200
    assert len(cloned_annotations.json()["results"]) == len(source_annotations)


def test_clone_studyset_without_annotations_when_disabled(
    auth_client, ingest_neurosynth, session
):
    studies_payload = auth_client.get("/api/studies/?page_size=2")
    study_ids = [study["id"] for study in studies_payload.json()["results"]]

    source_studyset, source_annotations = _create_studyset_with_annotation(
        auth_client, study_ids, name="clone-source-no-annots"
    )

    assert len(source_annotations) >= 1

    clone_resp = auth_client.post(
        f"/api/studysets/?source_id={source_studyset['id']}&copy_annotations=false",
        data={},
    )

    assert clone_resp.status_code == 200
    clone_data = clone_resp.json()

    assert set(_study_ids_from_payload(clone_data["studies"])) == set(
        _study_ids_from_payload(source_studyset["studies"])
    )
    assert clone_data["source"] == "neurostore"
    assert clone_data["source_id"] == source_studyset["id"]

    cloned_annotations = auth_client.get(
        f"/api/annotations/?studyset_id={clone_data['id']}"
    )
    assert cloned_annotations.status_code == 200
    assert cloned_annotations.json()["results"] == []


def test_studyset_studies_capture_curation_stub_uuid(auth_client, ingest_neurosynth, session):
    payload = auth_client.get("/api/studies/?page_size=2").json()
    study_ids = [study["id"] for study in payload["results"]]
    stub_uuid = "123e4567-e89b-12d3-a456-426614174000"

    create_resp = auth_client.post(
        "/api/studysets/",
        data={
            "name": "stubbed",
            "studies": [
                {"id": study_ids[0], "curation_stub_uuid": stub_uuid},
                study_ids[1],
            ],
        },
    )
    assert create_resp.status_code == 200
    studyset_id = create_resp.json()["id"]

    assoc = (
        session.query(StudysetStudy)
        .filter_by(studyset_id=studyset_id, study_id=study_ids[0])
        .one()
    )
    assert assoc.curation_stub_uuid == stub_uuid

    # If the caller omits the stub on update, we preserve the existing mapping
    update_resp = auth_client.put(
        f"/api/studysets/{studyset_id}",
        data={"studies": [study_ids[0], study_ids[1]]},
    )
    assert update_resp.status_code == 200
    assoc_after = (
        session.query(StudysetStudy)
        .filter_by(studyset_id=studyset_id, study_id=study_ids[0])
        .one()
    )
    assert assoc_after.curation_stub_uuid == stub_uuid


def test_non_nested_studyset_includes_studyset_studies(auth_client, ingest_neurosynth):
    payload = auth_client.get("/api/studies/?page_size=2").json()
    study_ids = [study["id"] for study in payload["results"]]
    stub_uuid = "123e4567-e89b-12d3-a456-426614174999"
    stub_uuid_2 = "123e4567-e89b-12d3-a456-426614174998"

    create_resp = auth_client.post(
        "/api/studysets/",
        data={
            "name": "stubbed-non-nested",
            "studies": [
                {"id": study_ids[0], "curation_stub_uuid": stub_uuid},
            ],
        },
    )
    assert create_resp.status_code == 200
    studyset_id = create_resp.json()["id"]

    get_resp = auth_client.get(f"/api/studysets/{studyset_id}?nested=false")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert "studyset_studies" in data
    assert any(
        assoc.get("id") == study_ids[0] and assoc.get("curation_stub_uuid") == stub_uuid
        for assoc in data.get("studyset_studies") or []
    )

    # Nested=True should also include studyset_studies
    nested_resp = auth_client.get(f"/api/studysets/{studyset_id}?nested=true")
    assert nested_resp.status_code == 200
    nested_data = nested_resp.json()
    assert "studyset_studies" in nested_data
    assert any(
        assoc.get("id") == study_ids[0] and assoc.get("curation_stub_uuid") == stub_uuid
        for assoc in nested_data.get("studyset_studies") or []
    )

    # Update the studyset with a second study + stub and ensure the mapping persists and updates.
    update_resp = auth_client.put(
        f"/api/studysets/{studyset_id}",
        data={
            "studies": [
                {"id": study_ids[0], "curation_stub_uuid": stub_uuid},
                {"id": study_ids[1], "curation_stub_uuid": stub_uuid_2},
            ],
        },
    )
    assert update_resp.status_code == 200
    update_data = update_resp.json()
    assert any(
        assoc.get("id") == study_ids[1] and assoc.get("curation_stub_uuid") == stub_uuid_2
        for assoc in update_data.get("studyset_studies") or []
    )

    # Final GET should reflect both mappings in a non-nested response.
    final_resp = auth_client.get(f"/api/studysets/{studyset_id}?nested=false")
    assert final_resp.status_code == 200
    final_data = final_resp.json()
    assert any(
        assoc.get("id") == study_ids[0] and assoc.get("curation_stub_uuid") == stub_uuid
        for assoc in final_data.get("studyset_studies") or []
    )
    assert any(
        assoc.get("id") == study_ids[1] and assoc.get("curation_stub_uuid") == stub_uuid_2
        for assoc in final_data.get("studyset_studies") or []
    )


def test_studyset_studies_survive_multiple_updates(auth_client, ingest_neurosynth):
    """
    Emulate the curation -> extraction sync sequence where the studyset is updated
    multiple times. Ensure associations are returned after successive PUTs.
    """
    payload = auth_client.get("/api/studies/?page_size=3").json()
    study_ids = [study["id"] for study in payload["results"]]
    stub_a = "aaaaaaaa-0000-0000-0000-aaaaaaaa0000"
    stub_b = "bbbbbbbb-1111-1111-1111-bbbbbbbb1111"

    # Initial create with one study
    create_resp = auth_client.post(
        "/api/studysets/",
        data={
            "name": "multi-update",
            "studies": [{"id": study_ids[0], "curation_stub_uuid": stub_a}],
        },
    )
    assert create_resp.status_code == 200
    studyset_id = create_resp.json()["id"]

    # First update: swap to a different study with a new stub
    update_resp_1 = auth_client.put(
        f"/api/studysets/{studyset_id}",
        data={
            "studies": [{"id": study_ids[1], "curation_stub_uuid": stub_b}],
        },
    )
    assert update_resp_1.status_code == 200
    data_1 = update_resp_1.json()
    assert data_1.get("studyset_studies")
    assert any(
        assoc.get("id") == study_ids[1] and
        assoc.get("curation_stub_uuid") == stub_b
        for assoc in data_1.get("studyset_studies") or []
    )

    # Second update: include both studies with their respective stubs
    update_resp_2 = auth_client.put(
        f"/api/studysets/{studyset_id}",
        data={
            "studies": [
                {"id": study_ids[0], "curation_stub_uuid": stub_a},
                {"id": study_ids[1], "curation_stub_uuid": stub_b},
            ],
        },
    )
    assert update_resp_2.status_code == 200
    data_2 = update_resp_2.json()
    assert any(
        assoc.get("id") == study_ids[0] and assoc.get("curation_stub_uuid") == stub_a
        for assoc in data_2.get("studyset_studies") or []
    )
    assert any(
        assoc.get("id") == study_ids[1] and assoc.get("curation_stub_uuid") == stub_b
        for assoc in data_2.get("studyset_studies") or []
    )

    # Final non-nested GET should reflect both associations, not an empty array.
    final_resp = auth_client.get(f"/api/studysets/{studyset_id}?nested=false")
    assert final_resp.status_code == 200
    final = final_resp.json()
    assert final.get("studyset_studies")
    assert set(s.get("id") for s in final.get("studyset_studies")) == {study_ids[0], study_ids[1]}


def test_stub_mapping_updates_when_switching_versions(auth_client, ingest_neurosynth, session):
    """
    If a stub is re-linked to a different study version,
    the mapping should move to the new study_id.
    """
    payload = auth_client.get("/api/studies/?page_size=3").json()
    study_ids = [study["id"] for study in payload["results"]]
    stub_uuid = "aaaaaaaa-1111-2222-3333-aaaaaaaa1111"

    # Initial create with study_ids[0] mapped to stub_uuid
    create_resp = auth_client.post(
        "/api/studysets/",
        data={
            "name": "switch-version",
            "studies": [{"id": study_ids[0], "curation_stub_uuid": stub_uuid}],
        },
    )
    assert create_resp.status_code == 200
    studyset_id = create_resp.json()["id"]

    # Update to point the same stub to a different study_id (study_ids[1])
    update_resp = auth_client.put(
        f"/api/studysets/{studyset_id}",
        data={
            "studies": [{"id": study_ids[1], "curation_stub_uuid": stub_uuid}],
        },
    )
    assert update_resp.status_code == 200
    data = update_resp.json()

    # Ensure the mapping moved to the new study id and the old association was removed.
    assert any(
        assoc.get("id") == study_ids[1] and assoc.get("curation_stub_uuid") == stub_uuid
        for assoc in data.get("studyset_studies") or []
    )
    assert not any(
        assoc.get("id") == study_ids[0] and assoc.get("curation_stub_uuid") == stub_uuid
        for assoc in data.get("studyset_studies") or []
    )
