import pytest

from ...models import Studyset, Study, User, Analysis, Condition
from ...schemas import StudySchema


def test_create_study_as_user_and_analysis_as_bot(auth_clients, session):
    # create study as user
    user_auth_client = next(ac for ac in auth_clients if ac.username == "user1-id")

    study_resp = user_auth_client.post("/api/studies/", data={"name": "test"})
    assert study_resp.status_code == 200
    study_id = study_resp.json()["id"]

    bot_auth_client = next(ac for ac in auth_clients if "clients" in ac.username)
    analysis_resp = bot_auth_client.post(
        "/api/analyses/", data={"name": "test-analysis", "study": study_id}
    )

    assert analysis_resp.status_code == 200


def test_get_studies(auth_client, ingest_neurosynth, ingest_neuroquery, session):
    # List of studies
    resp = auth_client.get("/api/studies/?nested=true&level=group")
    assert resp.status_code == 200
    studies_list = resp.json()["results"]

    assert isinstance(studies_list, list)

    assert len(studies_list) == resp.json()["metadata"]["total_count"]

    # Check study keys
    study = studies_list[0]

    s_id = study["id"]

    # Query specify analysis ID
    resp = auth_client.get(f"/api/studies/{s_id}")
    assert resp.status_code == 200
    full_study = resp.json()

    # Check extra keys
    for k in ["analyses", "created_at", "doi", "name"]:
        assert k in full_study

    assert full_study["doi"] == Study.query.filter_by(id=s_id).first().doi

    assert full_study["id"] == s_id


@pytest.mark.parametrize(
    "data",
    [
        {"metadata": {"cool": "important detail"}},
        {
            "analyses": [
                {
                    "conditions": [{"name": "face"}, {"name": "house"}],
                    "weights": [-1, 1],
                }
            ]
        },
    ],
)
def test_put_studies(auth_client, ingest_neurosynth, data, session):
    study_entry = Study.query.first()
    study_clone = auth_client.post(
        f"/api/studies/?source_id={study_entry.id}", data={}
    ).json()
    study_clone_id = study_clone["id"]
    payload = data
    if payload.get("analyses"):
        if payload["analyses"][0].get("conditions"):
            conditions = []
            for cond in payload["analyses"][0]["conditions"]:
                conditions.append(
                    auth_client.post("/api/conditions/", data=cond).json()
                )
            payload["analyses"][0]["conditions"] = [
                {"id": cond["id"]} for cond in conditions
            ]
        analysis_clone_id = study_clone["analyses"][0]["id"]
        payload["analyses"][0]["id"] = analysis_clone_id
    put_resp = auth_client.put(f"/api/studies/{study_clone_id}", data=payload)
    assert put_resp.status_code == 200

    updated_study_entry = Study.query.filter_by(id=study_clone_id).first()

    assert put_resp.json()["metadata"] == updated_study_entry.metadata_


def test_clone_studies(auth_client, ingest_neurovault, session):
    study_entry = Study.query.first()
    resp = auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={})
    data = resp.json()
    assert data["name"] == study_entry.name
    assert data["source_id"] == study_entry.id
    assert data["source"] == "neurostore"
    assert set([an["name"] for an in data["analyses"]]) == set(
        [an.name for an in study_entry.analyses]
    )

    # a clone of a clone should reference the original parent
    resp2 = auth_client.post(f"/api/studies/?source_id={data['id']}", data={})
    data2 = resp2.json()

    assert data2["name"] == study_entry.name
    assert data2["source_id"] == study_entry.id
    assert data2["source"] == "neurostore"
    assert set([an["name"] for an in data2["analyses"]]) == set(
        [an.name for an in study_entry.analyses]
    )


def test_clone_studies_with_data(auth_client, ingest_neurosynth, session):
    study_entry = Study.query.first()
    schema = StudySchema(context={"nested": True})
    study_data = schema.dump(study_entry)
    half_points = len(study_data["analyses"][0]["points"]) // 2

    first_analysis_points = study_data["analyses"][0]["points"][0:half_points]
    second_analysis_points = study_data["analyses"][0]["points"][half_points:]
    first_analysis_points[0]["coordinates"] = [0, 0, 0]
    second_analysis_points[0]["coordinates"] = [0, 0, 0]
    study_data["analyses"][0]["points"] = first_analysis_points
    study_data["analyses"].append(
        {"name": "new analysis", "points": second_analysis_points}
    )
    study_data["pmid"] = ""
    study_data["doi"] = ""

    resp = auth_client.post(
        f"/api/studies/?source_id={study_entry.id}",
        data=study_data,
    )
    data = resp.json()
    assert data["name"] == study_entry.name
    assert data["source_id"] == study_entry.id
    assert data["source"] == "neurostore"
    assert data["analyses"][0]["points"][0]["coordinates"] == [0, 0, 0]
    assert data["analyses"][1]["points"][0]["coordinates"] == [0, 0, 0]
    assert "new analysis" in [a["name"] for a in data["analyses"]]
    assert data["pmid"] is None
    assert data["doi"] is None


def test_private_studies(user_data, auth_clients, session):
    from ...resources.users import User

    client1, client2 = auth_clients[0:2]
    id1 = client1.username
    id2 = client2.username
    user1 = User.query.filter_by(external_id=id1).first()
    user2 = User.query.filter_by(external_id=id2).first()
    resp1 = client1.get("/api/studies/")
    resp2 = client2.get("/api/studies/")
    name_set1 = set(s["name"] for s in resp1.json()["results"])
    name_set2 = set(s["name"] for s in resp2.json()["results"])
    assert len(resp1.json()["results"]) == len(resp2.json()["results"]) == 4
    assert f"{user1.id}'s private study" in (name_set1 - name_set2)
    assert f"{user2.id}'s private study" in (name_set2 - name_set1)

    # but users can still access private studies with given link
    user2_private_study = next(
        (s["id"] for s in resp2.json()["results"] if "private" in s["name"])
    )

    user1_get = client1.get(f"/api/studies/{user2_private_study}")

    assert user1_get.status_code == 200


def test_post_studies(auth_client, ingest_neurosynth, session):
    payload = auth_client.get("/api/analyses/").json()["results"]
    analyses = [analysis["id"] for analysis in payload]
    my_study = {
        "name": "bomb",
        "description": "diggity",
        "analyses": analyses,
    }

    auth_client.post("/api/studies/", data=my_study)

    my_second_study = {"name": "asdfasfa", "pmid": "100000", "doi": "asdf;lds"}

    auth_client.post("/api/studies/", data=my_second_study)


def test_delete_studies(auth_client, ingest_neurosynth, session):
    study_db = Study.query.first()
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    study_db.user = user
    session.add(study_db)
    session.commit()

    get = auth_client.get(f"/api/studies/{study_db.id}")

    auth_client.delete(f"/api/studies/{study_db.id}")

    for analysis in get.json()["analyses"]:
        assert Analysis.query.filter_by(id=analysis).first() is None


def test_production_study_query(auth_client, user_data, session):
    auth_client.get(
        "/api/studies/?sort=name&page=1&desc=true&page_size=29999&nested=false&unique=true"
    )


@pytest.mark.skip("not supporting this feature anymore")
def test_getting_studysets_by_owner(auth_clients, user_data, session):
    client1 = auth_clients[0]
    id1 = client1.username
    user_studysets_db = Studyset.query.filter_by(user_id=id1).all()
    all_studysets_db = Studyset.query.all()
    non_user_studysets_db = list(set(all_studysets_db) - set(user_studysets_db))
    all_studysets = client1.get("/api/studies/")

    for study in all_studysets.json()["results"]:
        for studyset in study["studysets"]:
            assert studyset["id"] in [as_db.id for as_db in all_studysets_db]

    filtered_studysets = client1.get(f"/api/studies/?studyset_owner={id1}")
    for study in filtered_studysets.json()["results"]:
        for studyset in study["studysets"]:
            assert studyset["id"] in [us_db.id for us_db in user_studysets_db]
            assert studyset["id"] not in [nus_db.id for nus_db in non_user_studysets_db]


@pytest.mark.parametrize("param", ["true", "false", "doi", "name", "pmid"])
def test_get_unique_studies(auth_client, user_data, param, session):
    # clone a study owned by the user
    study_entry = Study.query.filter_by(user_id=auth_client.username).first()
    auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={})
    resp = auth_client.get(f"/api/studies/?unique={param}")
    assert resp.status_code == 200


def test_cache_update(auth_client, user_data, session):
    study_entry = Study.query.filter_by(user_id=auth_client.username).first()
    auth_client.get(f"/api/studies/{study_entry.id}")
    auth_client.get(f"/api/studies/{study_entry.id}?nested=true")
    auth_client.get(f"/api/studies/{study_entry.id}")
    auth_client.put(f"/api/studies/{study_entry.id}", data={"name": "new name"})
    auth_client.get(f"/api/studies/{study_entry.id}")


def test_post_meta_analysis(auth_client, user_data, session):
    study_data = {
        "name": "meta-analysis",
        "level": "meta",
        "analyses": [
            {
                "name": "emotion",
                "points": [
                    {
                        "x": 0,
                        "y": 0,
                        "z": 0,
                        "values": [
                            {
                                "kind": "z",
                                "value": 3.65,
                            },
                        ],
                    },
                ],
                "images": [
                    {
                        "url": "https://imagesrus.org/images/1234",
                    },
                ],
            },
        ],
    }
    resp = auth_client.post("/api/studies/", data=study_data)
    assert resp.status_code == 200


def test_studies_flat(auth_client, ingest_neurosynth, session):
    flat_resp = auth_client.get("/api/studies/?flat=true")
    reg_resp = auth_client.get("/api/studies/?flat=false")

    assert flat_resp.status_code == reg_resp.status_code == 200

    assert "analyses" not in flat_resp.json()["results"][0]
    assert "analyses" in reg_resp.json()["results"][0]


def test_create_study_new_user(new_user_client, mock_auth0_auth, session):

    study_resp = new_user_client.post("/api/studies/", data={"name": "test"})
    assert study_resp.status_code == 200


def test_condition_cloning_current_behavior(auth_client, ingest_neurovault, session):
    """
    Test to see the current condition cloning behavior.
    This test documents what happens currently with conditions during study cloning.
    """
    # Get the first study that has conditions
    study_with_conditions = None
    original_conditions = []
    
    for study in Study.query.all():
        for analysis in study.analyses:
            if analysis.analysis_conditions:
                study_with_conditions = study
                original_conditions = [
                    ac.condition for ac in analysis.analysis_conditions
                ]
                break
        if study_with_conditions:
            break
    
    if not study_with_conditions:
        pytest.skip("No study with conditions found")
    
    print(f"\n=== BEFORE CLONING ===")
    print(f"Original study ID: {study_with_conditions.id}")
    print(f"Original conditions: {[(c.id, c.name) for c in original_conditions]}")
    
    # Count total conditions in database before cloning
    total_conditions_before = Condition.query.count()
    print(f"Total conditions in DB before: {total_conditions_before}")
    
    # Clone the study
    resp = auth_client.post(f"/api/studies/?source_id={study_with_conditions.id}", data={})
    assert resp.status_code == 200
    
    cloned_study_data = resp.json()
    cloned_study_id = cloned_study_data["id"]
    
    print(f"\n=== AFTER CLONING ===")
    print(f"Cloned study ID: {cloned_study_id}")
    
    # Count total conditions in database after cloning
    total_conditions_after = Condition.query.count()
    print(f"Total conditions in DB after: {total_conditions_after}")
    
    # Get the cloned study from database
    cloned_study = Study.query.filter_by(id=cloned_study_id).first()
    assert cloned_study is not None
    
    # Check conditions in the cloned study
    cloned_conditions = []
    for analysis in cloned_study.analyses:
        for ac in analysis.analysis_conditions:
            cloned_conditions.append(ac.condition)
    
    print(f"Cloned conditions: {[(c.id, c.name) for c in cloned_conditions]}")
    
    # Check if conditions were cloned (new instances created) or referenced
    conditions_were_cloned = False
    for orig_cond in original_conditions:
        # Find corresponding condition in cloned study by name
        matching_cloned_cond = next(
            (c for c in cloned_conditions if c.name == orig_cond.name), None
        )
        assert matching_cloned_cond is not None, f"No matching condition found for {orig_cond.name}"
        
        if matching_cloned_cond.id != orig_cond.id:
            conditions_were_cloned = True
            print(f"CLONED: {orig_cond.name} - Original ID: {orig_cond.id}, Cloned ID: {matching_cloned_cond.id}")
        else:
            print(f"REFERENCED: {orig_cond.name} - Same ID: {orig_cond.id}")
    
    print(f"\n=== SUMMARY ===")
    print(f"Conditions were cloned: {conditions_were_cloned}")
    print(f"DB conditions increased from {total_conditions_before} to {total_conditions_after}")
    
    # This assertion will fail if conditions are being cloned (which is the current bug)
    # After the fix, this should pass
    assert not conditions_were_cloned, "Conditions should NOT be cloned, they should keep original references!"
