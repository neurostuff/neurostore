import pytest

from ...models import Studyset, User


def test_post_blank_annotation(auth_client, ingest_neurosynth, session):
    dset = Studyset.query.first()
    payload = {
        "studyset": dset.id,
        "name": "mah notes",
    }
    resp = auth_client.post("/api/annotations/", data=payload)
    assert resp.status_code == 200
    # assert there exists an annotation analysis for every analysis
    assert len(resp.json()["notes"]) == len(
        [a for study in dset.studies for a in study.analyses]
    )


def test_post_annotation(auth_client, ingest_neurosynth, session):
    dset = Studyset.query.first()
    # y for x in non_flat for y in x
    data = [
        {"study": s.id, "analysis": a.id, "note": {"foo": a.id}}
        for s in dset.studies
        for a in s.analyses
    ]
    payload = {
        "studyset": dset.id,
        "notes": data,
        "note_keys": {"foo": "string"},
        "name": "mah notes",
    }
    resp = auth_client.post("/api/annotations/", data=payload)
    assert resp.status_code == 200


# for some reason output is no longer valid
@pytest.mark.xfail
def test_get_annotations(auth_client, ingest_neurosynth, session):
    import pandas as pd
    from io import StringIO

    dset = Studyset.query.first()
    resp = auth_client.get(f"/api/annotations/?studyset_id={dset.id}")
    assert resp.status_code == 200

    annot_id = resp.json()["results"][0]["id"]

    annot = auth_client.get(f"/api/annotations/{annot_id}")
    assert annot.status_code == 200

    annot_export = auth_client.get(f"/api/annotations/{annot_id}?export=true")

    assert annot_export.status_code == 200

    df = pd.read_csv(StringIO(annot_export.json()["annotation_csv"]))

    assert isinstance(df, pd.DataFrame)


def test_clone_annotation(auth_client, simple_neurosynth_annotation, session):
    annotation_entry = simple_neurosynth_annotation
    resp = auth_client.post(
        f"/api/annotations/?source_id={annotation_entry.id}", data={}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == annotation_entry.name
    assert data["source_id"] == annotation_entry.id
    assert data["source"] == "neurostore"


def test_single_analysis_delete(auth_client, user_data, session):
    user = User.query.filter_by(name="user1").first()
    # get relevant studyset
    studysets = auth_client.get(f"/api/studysets/?user_id={user.external_id}")
    studyset_id = studysets.json()["results"][0]["id"]
    studyset = auth_client.get(f"/api/studysets/{studyset_id}")
    # get relevant annotation
    annotations = auth_client.get(f"/api/annotations/?studyset_id={studyset_id}")
    annotation_id = annotations.json()["results"][0]["id"]
    annotation = auth_client.get(f"/api/annotations/{annotation_id}")
    # pick study to edit
    study_id = studyset.json()["studies"][0]
    study = auth_client.get(f"/api/studies/{study_id}")

    # select analysis to delete
    analysis_id = study.json()["analyses"][0]
    auth_client.delete(f"/api/analyses/{analysis_id}")

    # test if annotations were updated
    updated_annotation = auth_client.get(f"/api/annotations/{annotation_id}")

    assert updated_annotation.status_code == 200
    assert (len(annotation.json()["notes"]) - 1) == (
        len(updated_annotation.json()["notes"])
    )


def test_study_removal_from_studyset(auth_client, session, user_data):
    user = User.query.filter_by(name="user1").first()
    # get relevant studyset
    studysets = auth_client.get(f"/api/studysets/?user_id={user.external_id}")
    studyset_id = studysets.json()["results"][0]["id"]
    studyset = auth_client.get(f"/api/studysets/{studyset_id}")
    # get relevant annotation
    annotations = auth_client.get(f"/api/annotations/?studyset_id={studyset_id}")
    annotation_id = annotations.json()["results"][0]["id"]
    annotation = auth_client.get(f"/api/annotations/{annotation_id}")
    # remove study from studyset
    studies = studyset.json()["studies"]
    studies.pop()

    # update studyset
    auth_client.put(f"/api/studysets/{studyset_id}", data={"studies": studies})

    # test if annotations were updated
    updated_annotation = auth_client.get(f"/api/annotations/{annotation_id}")

    assert updated_annotation.status_code == 200
    assert (len(annotation.json()["notes"]) - 1) == (
        len(updated_annotation.json()["notes"])
    )


def test_study_addition_to_studyset(auth_client, session, user_data):
    user = User.query.filter_by(name="user1").first()
    # get relevant studyset
    studysets = auth_client.get(f"/api/studysets/?user_id={user.external_id}")
    studyset_id = studysets.json()["results"][0]["id"]
    studyset = auth_client.get(f"/api/studysets/{studyset_id}")
    # get relevant annotation
    annotations = auth_client.get(f"/api/annotations/?studyset_id={studyset_id}")
    annotation_id = annotations.json()["results"][0]["id"]
    annotation = auth_client.get(f"/api/annotations/{annotation_id}")
    # add a new study
    studies = studyset.json()["studies"]
    user2 = User.query.filter_by(name="user2").first()
    studies_u2 = auth_client.get(f"/api/studies/?user_id={user2.external_id}")
    studies_u2_ids = [s["id"] for s in studies_u2.json()["results"]]
    studies.extend(studies_u2_ids)

    # update studyset
    auth_client.put(f"/api/studysets/{studyset_id}", data={"studies": studies})

    # test if annotations were updated
    updated_annotation = auth_client.get(f"/api/annotations/{annotation_id}")

    assert updated_annotation.status_code == 200
    assert (len(annotation.json()["notes"]) + 1) == (
        len(updated_annotation.json()["notes"])
    )


def test_blank_slate_creation(auth_client, session):
    # create empty studyset
    studyset_data = {"name": "test studyset"}
    studyset_post = auth_client.post("/api/studysets/", data=studyset_data)
    ss_id = studyset_post.json()["id"]
    # create annotation
    annotation_data = {
        "studyset": ss_id,
        "note_keys": {"include": "boolean"},
        "name": "mah notes",
    }
    annotation_post = auth_client.post("/api/annotations/", data=annotation_data)

    # create study
    study_data = {"name": "fake study"}
    study_post = auth_client.post("/api/studies/", data=study_data)
    s_id = study_post.json()["id"]

    # add study to studyset
    studyset_put_data = {"studies": [s_id]}
    _ = auth_client.put(f"/api/studysets/{ss_id}", data=studyset_put_data)

    # update study with analyses
    study_put_data = {"analyses": [{"name": "analysis1"}, {"name": "analysis2"}]}
    _ = auth_client.put(f"/api/studies/{s_id}", data=study_put_data)

    annotation_get = auth_client.get(f"/api/annotations/{annotation_post.json()['id']}")

    assert len(annotation_get.json()["notes"]) == (
        (len(annotation_post.json()["notes"]) + 2)
    )


def test_analysis_addition_to_studyset(auth_client, session, user_data):
    user = User.query.filter_by(name="user1").first()
    # get relevant studyset
    studysets = auth_client.get(f"/api/studysets/?user_id={user.external_id}")
    studyset_id = studysets.json()["results"][0]["id"]
    studyset = auth_client.get(f"/api/studysets/{studyset_id}")
    # get relevant annotation
    annotations = auth_client.get(f"/api/annotations/?studyset_id={studyset_id}")
    annotation_id = annotations.json()["results"][0]["id"]
    annotation = auth_client.get(f"/api/annotations/{annotation_id}")
    # add a new analysis
    study_id = studyset.json()["studies"][0]
    analysis = {"id": auth_client.get(f"/api/studies/{study_id}").json()["analyses"][0]}
    analysis_new = {"name": "new_analysis"}
    analyses = [analysis, analysis_new]
    updated_study = auth_client.put(
        f"/api/studies/{study_id}", data={"analyses": [analysis, analysis_new]}
    )
    assert len(updated_study.json()["analyses"]) == len(analyses)

    # test if annotations were updated
    updated_annotation = auth_client.get(f"/api/annotations/{annotation_id}")

    assert updated_annotation.status_code == 200
    assert (len(annotation.json()["notes"]) + 1) == (
        len(updated_annotation.json()["notes"])
    )


def test_mismatched_notes(auth_client, ingest_neurosynth, session):
    dset = Studyset.query.first()
    # y for x in non_flat for y in x
    data = [
        {"study": s.id, "analysis": a.id, "note": {"foo": a.id, "doo": s.id}}
        for s in dset.studies
        for a in s.analyses
    ]
    note_keys = {"foo": "string", "doo": "string"}
    payload = {
        "studyset": dset.id,
        "notes": data,
        "note_keys": note_keys,
        "name": "mah notes",
    }

    # proper post
    auth_client.post("/api/annotations/", data=payload)

    # additional key only added to one analysis
    data[0]["note"]["bar"] = "not real!"
    assert auth_client.post("/api/annotations/", data=payload).status_code == 400

    # incorrect key in one analysis
    data[0]["note"].pop("foo")
    assert auth_client.post("/api/annotations/", data=payload).status_code == 400

    # update a single analysis with incorrect key
    bad_payload = {"notes": [data[0]]}
    assert auth_client.post("/api/annotations/", data=bad_payload).status_code == 400


# test push analysis id that does not exist
# Handle error better
def test_put_nonexistent_analysis(auth_client, ingest_neurosynth, session):
    dset = Studyset.query.first()
    # y for x in non_flat for y in x
    data = [
        {"study": s.id, "analysis": a.id, "note": {"foo": a.id, "doo": s.id}}
        for s in dset.studies
        for a in s.analyses
    ]
    note_keys = {"foo": "string", "doo": "string"}
    payload = {
        "studyset": dset.id,
        "notes": data,
        "note_keys": note_keys,
        "name": "mah notes",
    }

    # proper post
    annot = auth_client.post("/api/annotations/", data=payload)

    # have to pass all the notes even if only updating one attribute
    new_value = "something new"
    data[0]["analysis"] = new_value
    bad_payload = {"notes": data}

    assert (
        auth_client.put(
            f"/api/annotations/{annot.json()['id']}", data=bad_payload
        ).status_code
        == 400
    )


def test_post_put_subset_of_analyses(auth_client, ingest_neurosynth, session):
    dset = Studyset.query.first()
    # y for x in non_flat for y in x
    data = [
        {"study": s.id, "analysis": a.id, "note": {"foo": a.id, "doo": s.id}}
        for s in dset.studies
        for a in s.analyses
    ]
    # remove last note
    missing_note = data.pop()

    note_keys = {"foo": "string", "doo": "string"}
    payload = {
        "studyset": dset.id,
        "notes": data,
        "note_keys": note_keys,
        "name": "mah notes",
    }

    annot = auth_client.post("/api/annotations/", data=payload)
    assert annot.status_code == 200
    # have to pass all the notes even if only updating one attribute
    # remove last note again

    assert (
        auth_client.put(
            f"/api/annotations/{annot.json()['id']}", data=payload
        ).status_code
        == 400
    )


def test_correct_note_overwrite(auth_client, ingest_neurosynth, session):
    dset = Studyset.query.first()
    # y for x in non_flat for y in x
    data = [
        {"study": s.id, "analysis": a.id, "note": {"foo": a.id, "doo": s.id}}
        for s in dset.studies
        for a in s.analyses
    ]
    payload = {
        "studyset": dset.id,
        "notes": data,
        "note_keys": {"foo": "string", "doo": "string"},
        "name": "mah notes",
    }

    # proper post
    annot = auth_client.post("/api/annotations/", data=payload)

    # have to pass all the notes even if only updating one attribute
    new_value = "something new"
    data[0]["note"]["doo"] = new_value
    doo_payload = {"notes": data}
    put_resp = auth_client.put(
        f"/api/annotations/{annot.json()['id']}", data=doo_payload
    )

    get_resp = auth_client.get(f"/api/annotations/{annot.json()['id']}")

    assert len(put_resp.json()["notes"]) == len(data)
    assert get_resp.json() == put_resp.json()
    assert (
        get_resp.json()["notes"][0]["note"]["doo"]
        == put_resp.json()["notes"][0]["note"]["doo"]
        == new_value
    )
