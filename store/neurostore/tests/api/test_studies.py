import pytest

from ..request_utils import decode_json
from ...models import Studyset, Study, User, Analysis


def test_create_study_as_user_and_analysis_as_bot(auth_clients):
    # create study as user
    user_auth_client = next(ac for ac in auth_clients if ac.username == 'user1-id')

    study_resp = user_auth_client.post("/api/studies/", data={"name": "test"})
    study_id = study_resp.json["id"]

    bot_auth_client = next(ac for ac in auth_clients if 'clients' in ac.username)
    analysis_resp = bot_auth_client.post(
        "/api/analyses/",
        data={"name": "test-analysis", "study": study_id}
    )

    assert analysis_resp.status_code == 200


def test_get_studies(auth_client, ingest_neurosynth, ingest_neuroquery):
    # List of studies
    resp = auth_client.get("/api/studies/?nested=true&level=group")
    assert resp.status_code == 200
    studies_list = decode_json(resp)["results"]

    assert type(studies_list) == list

    assert len(studies_list) == resp.json["metadata"]["total_count"]

    # Check study keys
    study = studies_list[0]

    s_id = study["id"]

    # Query specify analysis ID
    resp = auth_client.get(f"/api/studies/{s_id}")
    assert resp.status_code == 200
    full_study = decode_json(resp)

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
def test_put_studies(auth_client, ingest_neurosynth, data):
    study_entry = Study.query.first()
    study_clone = auth_client.post(
        f"/api/studies/?source_id={study_entry.id}", data={}
    ).json
    study_clone_id = study_clone["id"]
    payload = data
    if payload.get("analyses"):
        if payload["analyses"][0].get("conditions"):
            conditions = []
            for cond in payload["analyses"][0]["conditions"]:
                conditions.append(auth_client.post("/api/conditions/", data=cond).json)
            payload["analyses"][0]["conditions"] = [
                {"id": cond["id"]} for cond in conditions
            ]
        analysis_clone_id = study_clone["analyses"][0]["id"]
        payload["analyses"][0]["id"] = analysis_clone_id
    put_resp = auth_client.put(f"/api/studies/{study_clone_id}", data=payload)
    assert put_resp.status_code == 200

    updated_study_entry = Study.query.filter_by(id=study_clone_id).first()

    assert put_resp.json["metadata"] == updated_study_entry.metadata_


def test_clone_studies(auth_client, ingest_neurosynth, ingest_neurovault):
    study_entry = Study.query.filter(Study.metadata_.isnot(None)).first()
    resp = auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={})
    data = resp.json
    assert data["name"] == study_entry.name
    assert data["source_id"] == study_entry.id
    assert data["source"] == "neurostore"
    assert set([an["name"] for an in data["analyses"]]) == set(
        [an.name for an in study_entry.analyses]
    )

    # a clone of a clone should reference the original parent
    resp2 = auth_client.post(f"/api/studies/?source_id={data['id']}", data={})
    data2 = resp2.json

    assert data2["name"] == study_entry.name
    assert data2["source_id"] == study_entry.id
    assert data2["source"] == "neurostore"
    assert set([an["name"] for an in data2["analyses"]]) == set(
        [an.name for an in study_entry.analyses]
    )


def test_private_studies(user_data, auth_clients):
    from ...resources.users import User

    client1, client2 = auth_clients[0:2]
    id1 = client1.username
    id2 = client2.username
    user1 = User.query.filter_by(external_id=id1).first()
    user2 = User.query.filter_by(external_id=id2).first()
    resp1 = client1.get("/api/studies/")
    resp2 = client2.get("/api/studies/")
    name_set1 = set(s["name"] for s in resp1.json["results"])
    name_set2 = set(s["name"] for s in resp2.json["results"])
    assert len(resp1.json["results"]) == len(resp2.json["results"]) == 4
    assert f"{user1.id}'s private study" in (name_set1 - name_set2)
    assert f"{user2.id}'s private study" in (name_set2 - name_set1)

    # but users can still access private studies with given link
    user2_private_study = next(
        (s["id"] for s in resp2.json["results"] if "private" in s["name"])
    )

    user1_get = client1.get(f"/api/studies/{user2_private_study}")

    assert user1_get.status_code == 200


def test_post_studies(auth_client, ingest_neurosynth):
    payload = auth_client.get("/api/analyses/").json["results"]
    analyses = [analysis["id"] for analysis in payload]
    my_study = {
        "name": "bomb",
        "description": "diggity",
        "analyses": analyses,
    }

    auth_client.post("/api/studies/", data=my_study)


def test_delete_studies(auth_client, ingest_neurosynth, session):
    study_db = Study.query.first()
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    study_db.user = user
    session.add(study_db)
    session.commit()

    get = auth_client.get(f"/api/studies/{study_db.id}")

    auth_client.delete(f"/api/studies/{study_db.id}")

    for analysis in get.json["analyses"]:
        assert Analysis.query.filter_by(id=analysis).first() is None


def test_getting_studysets_by_owner(auth_clients, user_data):
    client1 = auth_clients[0]
    id1 = client1.username
    user_studysets_db = Studyset.query.filter_by(user_id=id1).all()
    all_studysets_db = Studyset.query.all()
    non_user_studysets_db = list(set(all_studysets_db) - set(user_studysets_db))
    all_studysets = client1.get("/api/studies/")

    for study in all_studysets.json["results"]:
        for studyset in study["studysets"]:
            assert studyset["id"] in [as_db.id for as_db in all_studysets_db]

    filtered_studysets = client1.get(f"/api/studies/?studyset_owner={id1}")
    for study in filtered_studysets.json["results"]:
        for studyset in study["studysets"]:
            assert studyset["id"] in [us_db.id for us_db in user_studysets_db]
            assert studyset["id"] not in [nus_db.id for nus_db in non_user_studysets_db]


@pytest.mark.parametrize("param", ["true", "false", "doi", "name", "pmid"])
def test_get_unique_studies(auth_client, user_data, param):
    # clone a study owned by the user
    study_entry = Study.query.filter_by(user_id=auth_client.username).first()
    auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={})
    resp = auth_client.get(f"/api/studies/?unique={param}")
    assert resp.status_code == 200


def test_post_meta_analysis(auth_client, user_data):
    study_data = {
        "name": "meta-analysis",
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
                "entities": [
                    {
                        "level": "meta",
                    },
                ],
            },
        ],
    }
    resp = auth_client.post("/api/studies/", data=study_data)
    assert resp.status_code == 200
