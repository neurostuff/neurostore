from datetime import datetime, timezone

from ...models import (
    Studyset,
    Annotation,
    User,
    BaseStudy,
    Study,
    Analysis,
    StudysetStudy,
    AnnotationAnalysis,
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
)
from ..utils import ordered_note_keys


def _create_annotation_with_two_analyses(session, user, analysis_orders=None):
    order_one = None
    order_two = None
    if analysis_orders:
        order_one, order_two = analysis_orders
    base_study = BaseStudy(name="Test Base Study", level="group", user=user)
    study = Study(
        name="Test Study",
        level="group",
        base_study=base_study,
        user=user,
    )
    analysis1 = Analysis(name="Analysis 1", study=study, user=user, order=order_one)
    analysis2 = Analysis(name="Analysis 2", study=study, user=user, order=order_two)

    studyset = Studyset(name="Test Studyset", user=user)

    session.add_all([base_study, study, analysis1, analysis2, studyset])
    session.flush()

    studyset_study = StudysetStudy(study_id=study.id, studyset_id=studyset.id)
    session.add(studyset_study)
    session.flush()

    annotation = Annotation(
        name="Test Annotation",
        studyset=studyset,
        user=user,
        note_keys=ordered_note_keys({"existing": "string"}),
    )

    session.add(annotation)
    session.flush()

    with session.no_autoflush:
        annotation.annotation_analyses = [
            AnnotationAnalysis(
                analysis=analysis1,
                studyset_study=studyset_study,
                annotation=annotation,
                note={"existing": "A1"},
                user=user,
                study_id=analysis1.study_id,
                studyset_id=studyset_study.studyset_id,
            ),
            AnnotationAnalysis(
                analysis=analysis2,
                studyset_study=studyset_study,
                annotation=annotation,
                note={"existing": "A2"},
                user=user,
                study_id=analysis2.study_id,
                studyset_id=studyset_study.studyset_id,
            ),
        ]
        session.add_all(annotation.annotation_analyses)
    session.commit()
    return annotation, base_study


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
    annot = Annotation.query.filter_by(id=resp.json()["id"]).one()

    assert annot.annotation_analyses[0].user_id == annot.user_id


def test_blank_annotation_populates_note_fields(
    auth_client, ingest_neurosynth, session
):
    dset = Studyset.query.first()
    note_keys = ordered_note_keys({"included": "boolean", "quality": "string"})
    payload = {
        "studyset": dset.id,
        "note_keys": note_keys,
        "name": "with defaults",
    }

    resp = auth_client.post("/api/annotations/", data=payload)
    assert resp.status_code == 200

    for note in resp.json()["notes"]:
        assert set(note["note"].keys()) == set(note_keys.keys())
        assert all(value is None for value in note["note"].values())


def test_annotation_rejects_empty_note(auth_client, ingest_neurosynth, session):
    dset = Studyset.query.first()
    study = dset.studies[0]
    analysis = study.analyses[0]

    payload = {
        "studyset": dset.id,
        "notes": [
            {
                "study": study.id,
                "analysis": analysis.id,
                "note": {},
            }
        ],
        "note_keys": ordered_note_keys({"included": "boolean"}),
        "name": "invalid annotation",
    }

    resp = auth_client.post("/api/annotations/", data=payload)

    assert resp.status_code == 422
    error = resp.json()
    assert "note must include at least one field" in error["detail"]


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
        "note_keys": ordered_note_keys({"foo": "string"}),
        "name": "mah notes",
    }
    resp = auth_client.post("/api/annotations/", data=payload)
    assert resp.status_code == 200
    annot = Annotation.query.filter_by(id=resp.json()["id"]).one()

    assert annot.annotation_analyses[0].user_id == annot.user_id


def test_get_annotations(auth_client, ingest_neurosynth, session):
    # import pandas as pd
    # from io import StringIO

    dset = Studyset.query.first()
    resp = auth_client.get(f"/api/annotations/?studyset_id={dset.id}")
    assert resp.status_code == 200

    annot_id = resp.json()["results"][0]["id"]

    annot = auth_client.get(f"/api/annotations/{annot_id}")
    assert annot.status_code == 200

    # annot_export = auth_client.get(f"/api/annotations/{annot_id}?export=true")

    # assert annot_export.status_code == 200

    # df = pd.read_csv(StringIO(annot_export.json()["annotation_csv"]))

    # assert isinstance(df, pd.DataFrame)


def test_get_annotation_orders_notes_by_analysis_order(auth_client, session):
    user = User.query.filter_by(external_id=auth_client.username).first()
    annotation, _ = _create_annotation_with_two_analyses(
        session, user, analysis_orders=(2, 1)
    )

    resp = auth_client.get(f"/api/annotations/{annotation.id}")
    assert resp.status_code == 200

    notes = resp.json()["notes"]
    assert [note["analysis_name"] for note in notes] == [
        "Analysis 2",
        "Analysis 1",
    ]


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
    ss_update = auth_client.put(
        f"/api/studysets/{studyset_id}", data={"studies": studies}
    )
    assert ss_update.status_code == 200

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
        "note_keys": ordered_note_keys({"include": "boolean"}),
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
    note_keys = ordered_note_keys({"foo": "string", "doo": "string"})
    payload = {
        "studyset": dset.id,
        "notes": data,
        "note_keys": note_keys,
        "name": "mah notes",
    }

    # proper post
    auth_client.post("/api/annotations/", data=payload)

    # allowing this behavior now
    # additional key only added to one analysis
    data[0]["note"]["bar"] = "not real!"
    assert auth_client.post("/api/annotations/", data=payload).status_code == 200

    # incorrect key in one analysis
    data[0]["note"].pop("foo")
    assert auth_client.post("/api/annotations/", data=payload).status_code == 200

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
    note_keys = ordered_note_keys({"foo": "string", "doo": "string"})
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
    data.pop()

    note_keys = ordered_note_keys({"foo": "string", "doo": "string"})
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
        "note_keys": ordered_note_keys({"foo": "string", "doo": "string"}),
        "name": "mah notes",
    }

    # proper post
    annot = auth_client.post("/api/annotations/", data=payload)
    assert annot.status_code == 200

    # have to pass all the notes even if only updating one attribute
    new_value = "something new"
    data[0]["note"]["doo"] = new_value
    doo_payload = {"notes": data}
    put_resp = auth_client.put(
        f"/api/annotations/{annot.json()['id']}", data=doo_payload
    )

    get_resp = auth_client.get(f"/api/annotations/{annot.json()['id']}")
    # get_notes = sorted(get_resp.json()['notes'], key=lambda x: x['analysis'])
    # put_notes = sorted(put_resp.json()['notes'], key=lambda x: x['analysis'])
    assert len(put_resp.json()["notes"]) == len(data)
    assert get_resp.json() == put_resp.json()
    target_analysis_id = data[0]["analysis"]
    notes_by_analysis = {note["analysis"]: note for note in get_resp.json()["notes"]}
    assert notes_by_analysis[target_analysis_id]["note"]["doo"] == new_value


def test_put_annotation_applies_pipeline_columns(auth_client, session):
    user = User.query.filter_by(external_id=auth_client.username).first()
    annotation, base_study = _create_annotation_with_two_analyses(session, user)

    pipeline = Pipeline(name="DemoPipeline")
    config = PipelineConfig(
        pipeline=pipeline,
        version="1.0.0",
        config_hash="demo_hash",
        config_args={},
    )
    result = PipelineStudyResult(
        base_study=base_study,
        config=config,
        status="SUCCESS",
        date_executed=datetime(2024, 1, 1, tzinfo=timezone.utc),
        result_data={
            "string_field": "demo",
            "numeric_field": 42,
            "array_field": [
                {"name": "a"},
                {"name": "b"},
            ],
        },
        file_inputs={},
    )
    session.add_all([pipeline, config, result])
    session.commit()

    payload = {
        "pipelines": [
            {
                "name": pipeline.name,
                "columns": ["string_field", "numeric_field", "name"],
            }
        ]
    }

    resp = auth_client.put(f"/api/annotations/{annotation.id}", data=payload)
    assert resp.status_code == 200
    body = resp.json()

    assert body["note_keys"]["existing"]["type"] == "string"
    assert body["note_keys"]["string_field"]["type"] == "string"
    assert body["note_keys"]["numeric_field"]["type"] == "number"
    assert body["note_keys"]["name"]["type"] == "string"

    notes = body["notes"]
    assert len(notes) == 2
    for entry in notes:
        note = entry["note"]
        assert note["existing"] in {"A1", "A2"}
        assert note["string_field"] == "demo"
        assert note["numeric_field"] == 42
        assert note["name"] == "a,b"


def test_put_annotation_pipeline_column_conflict_suffix(auth_client, session):
    user = User.query.filter_by(external_id=auth_client.username).first()
    annotation, base_study = _create_annotation_with_two_analyses(session, user)

    pipeline_one = Pipeline(name="PipelineOne")
    config_one = PipelineConfig(
        pipeline=pipeline_one,
        version="1.0.0",
        config_hash="hash_one",
        config_args={},
    )
    result_one = PipelineStudyResult(
        base_study=base_study,
        config=config_one,
        status="SUCCESS",
        date_executed=datetime(2024, 1, 1, tzinfo=timezone.utc),
        result_data={
            "string_field": "primary",
            "array_field": [
                {"name": "a"},
                {"name": "b"},
            ],
        },
        file_inputs={},
    )

    pipeline_two = Pipeline(name="PipelineTwo")
    config_two = PipelineConfig(
        pipeline=pipeline_two,
        version="2.0.0",
        config_hash="hash_two",
        config_args={},
    )
    result_two = PipelineStudyResult(
        base_study=base_study,
        config=config_two,
        status="SUCCESS",
        date_executed=datetime(2024, 1, 2, tzinfo=timezone.utc),
        result_data={"string_field": "secondary"},
        file_inputs={},
    )

    session.add_all(
        [
            pipeline_one,
            config_one,
            result_one,
            pipeline_two,
            config_two,
            result_two,
        ]
    )
    session.commit()

    payload = {
        "pipelines": [
            {"name": pipeline_one.name, "columns": ["string_field", "name"]},
            {
                "name": pipeline_two.name,
                "columns": ["string_field"],
                "version": "2.0.0",
            },
        ]
    }

    resp = auth_client.put(f"/api/annotations/{annotation.id}", data=payload)
    assert resp.status_code == 200
    body = resp.json()

    key_one = f"string_field_{pipeline_one.name}_{config_one.version}_{config_one.id}"
    key_two = f"string_field_{pipeline_two.name}_{config_two.version}_{config_two.id}"

    assert key_one in body["note_keys"]
    assert key_two in body["note_keys"]
    assert body["note_keys"][key_one]["type"] == "string"
    assert body["note_keys"][key_two]["type"] == "string"
    assert body["note_keys"]["name"]["type"] == "string"

    for entry in body["notes"]:
        note = entry["note"]
        assert note[key_one] == "primary"
        assert note[key_two] == "secondary"
        assert note["name"] == "a,b"


def test_annotation_analyses_post(auth_client, ingest_neurosynth, session):
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
        "note_keys": ordered_note_keys({"foo": "string", "doo": "string"}),
        "name": "mah notes",
    }

    # proper post
    annot = auth_client.post("/api/annotations/", data=payload)
    assert annot.status_code == 200

    # have to pass all the notes even if only updating one attribute
    new_value = "something new"
    data[0]["note"]["doo"] = new_value
    data[1]["note"]["doo"] = new_value
    data[2]["note"]["doo"] = new_value  # will not be updated
    data[0]["id"] = annot.json()["id"] + "_" + data[0]["analysis"]
    data[1]["annotation"] = annot.json()["id"]
    post_resp = auth_client.post("/api/annotation-analyses/", data=data[0:3])
    assert post_resp.status_code == 200

    get_resp = auth_client.get(f"/api/annotations/{annot.json()['id']}")

    assert len(post_resp.json()) == 2  # third input did not have proper id
    updated_by_analysis = {
        note["analysis"]: note["note"]["doo"] for note in post_resp.json()
    }
    current_by_analysis = {
        note["analysis"]: note["note"]["doo"] for note in get_resp.json()["notes"]
    }
    for analysis_id, value in updated_by_analysis.items():
        assert current_by_analysis[analysis_id] == value == new_value
