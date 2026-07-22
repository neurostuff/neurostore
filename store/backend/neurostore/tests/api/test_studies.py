import uuid

import pytest

pytestmark = pytest.mark.anyio

from neurostore.models import Analysis, Study, Studyset, User
from neurostore.schemas import StudySchema


async def test_create_study_as_user_and_analysis_as_bot(async_auth_clients, session):
    # create study as user
    user_auth_client = next(ac for ac in async_auth_clients if ac.username == "user1-id")

    study_resp = await user_auth_client.post("/api/studies/", data={"name": "test"})
    assert study_resp.status_code == 200
    study_id = study_resp.json()["id"]

    bot_auth_client = next(ac for ac in async_auth_clients if "clients" in ac.username)
    analysis_resp = await bot_auth_client.post(
        "/api/analyses/", data={"name": "test-analysis", "study": study_id}
    )

    assert analysis_resp.status_code == 200


async def test_get_studies(async_auth_client, ingest_neurosynth, ingest_neuroquery, session):
    # List of studies
    resp = await async_auth_client.get("/api/studies/?nested=true&level=group")
    assert resp.status_code == 200
    studies_list = resp.json()["results"]

    assert isinstance(studies_list, list)

    assert len(studies_list) == resp.json()["metadata"]["total_count"]

    # Check study keys
    study = studies_list[0]

    s_id = study["id"]

    # Query specify analysis ID
    resp = await async_auth_client.get(f"/api/studies/{s_id}")
    assert resp.status_code == 200
    full_study = resp.json()

    # Check extra keys
    for k in ["analyses", "created_at", "doi", "name", "tables"]:
        assert k in full_study

    assert full_study["doi"] == Study.query.filter_by(id=s_id).first().doi

    assert full_study["id"] == s_id


async def test_study_emits_all_media_flags(async_auth_client, session):
    create_study = await async_auth_client.post(
        "/api/studies/",
        data={
            "name": "study-media-flags",
            "pmid": "910011",
            "doi": "10.1000/study-media-flags",
            "analyses": [
                {
                    "name": "analysis-media-flags",
                    "images": [
                        {"filename": "z-map.nii.gz", "value_type": "Z"},
                        {"filename": "t-map.nii.gz", "value_type": "T map"},
                        {"filename": "beta-map.nii.gz", "value_type": "M"},
                        {"filename": "variance-map.nii.gz", "value_type": "variance"},
                    ],
                }
            ],
        },
    )
    assert create_study.status_code == 200

    response = await async_auth_client.get(f"/api/studies/{create_study.json()['id']}")
    assert response.status_code == 200
    payload = response.json()

    assert payload["has_coordinates"] is False
    assert payload["has_images"] is True
    assert payload["has_z_maps"] is True
    assert payload["has_t_maps"] is True
    assert payload["has_beta_and_variance_maps"] is True


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
async def test_put_studies(async_auth_client, ingest_neurosynth, data, session):
    study_entry = Study.query.first()
    study_clone = (await async_auth_client.post(
        f"/api/studies/?source_id={study_entry.id}", data={}
    )).json()
    study_clone_id = study_clone["id"]
    payload = data
    if payload.get("analyses"):
        if payload["analyses"][0].get("conditions"):
            conditions = []
            for cond in payload["analyses"][0]["conditions"]:
                conditions.append(
                    (await async_auth_client.post("/api/conditions/", data=cond)).json()
                )
            payload["analyses"][0]["conditions"] = [
                {"id": cond["id"]} for cond in conditions
            ]
        analysis_clone_id = study_clone["analyses"][0]["id"]
        payload["analyses"][0]["id"] = analysis_clone_id
    put_resp = await async_auth_client.put(f"/api/studies/{study_clone_id}", data=payload)
    assert put_resp.status_code == 200

    updated_study_entry = Study.query.filter_by(id=study_clone_id).first()

    assert put_resp.json()["metadata"] == updated_study_entry.metadata_


async def test_clone_studies(async_auth_client, ingest_neurovault, session):
    study_entry = Study.query.first()
    resp = await async_auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={})
    data = resp.json()
    assert data["name"] == study_entry.name
    assert data["source_id"] == study_entry.id
    assert data["source"] == "neurostore"
    assert set([an["name"] for an in data["analyses"]]) == set(
        [an.name for an in study_entry.analyses]
    )

    # a clone of a clone should reference the original parent
    resp2 = await async_auth_client.post(f"/api/studies/?source_id={data['id']}", data={})
    data2 = resp2.json()

    assert data2["name"] == study_entry.name
    assert data2["source_id"] == study_entry.id
    assert data2["source"] == "neurostore"
    assert set([an["name"] for an in data2["analyses"]]) == set(
        [an.name for an in study_entry.analyses]
    )


async def test_clone_study_with_missing_source_id_sets_null(
    async_auth_client, ingest_neurosynth, session
):
    study_entry = Study.query.first()
    resp = await async_auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={})
    assert resp.status_code == 200
    clone = resp.json()

    session.delete(study_entry)
    session.commit()

    resp2 = await async_auth_client.post(f"/api/studies/?source_id={clone['id']}", data={})
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["source_id"] is None


async def test_put_study_with_missing_source_id_sets_null(
    async_auth_client, ingest_neurosynth, session
):
    study_entry = Study.query.first()
    resp = await async_auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={})
    assert resp.status_code == 200
    clone = resp.json()

    clone_record = Study.query.filter_by(id=clone["id"]).first()
    clone_record.source_id = str(uuid.uuid4())
    session.add(clone_record)
    session.commit()

    put_resp = await async_auth_client.put(
        f"/api/studies/{clone_record.id}", data={"name": "updated name"}
    )
    assert put_resp.status_code == 200
    assert put_resp.json()["source_id"] is None
    session.expire_all()
    assert Study.query.filter_by(id=clone_record.id).first().source_id is None


async def test_clone_studies_with_data(async_auth_client, ingest_neurosynth, session):
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

    resp = await async_auth_client.post(
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


async def test_private_studies(user_data, async_auth_clients, session):
    from neurostore.resources.users import User

    client1, client2 = async_auth_clients[0:2]
    id1 = client1.username
    id2 = client2.username
    user1 = User.query.filter_by(external_id=id1).first()
    user2 = User.query.filter_by(external_id=id2).first()
    resp1 = await client1.get("/api/studies/")
    resp2 = await client2.get("/api/studies/")
    name_set1 = set(s["name"] for s in resp1.json()["results"])
    name_set2 = set(s["name"] for s in resp2.json()["results"])
    assert len(resp1.json()["results"]) == len(resp2.json()["results"]) == 4
    assert f"{user1.id}'s private study" in (name_set1 - name_set2)
    assert f"{user2.id}'s private study" in (name_set2 - name_set1)

    # but users can still access private studies with given link
    user2_private_study = next(
        (s["id"] for s in resp2.json()["results"] if "private" in s["name"])
    )

    user1_get = await client1.get(f"/api/studies/{user2_private_study}")

    assert user1_get.status_code == 200


async def test_post_studies(async_auth_client, ingest_neurosynth, session):
    payload = (await async_auth_client.get("/api/analyses/")).json()["results"]
    analyses = [analysis["id"] for analysis in payload]
    my_study = {
        "name": "bomb",
        "description": "diggity",
        "analyses": analyses,
    }

    await async_auth_client.post("/api/studies/", data=my_study)

    my_second_study = {"name": "asdfasfa", "pmid": "100000", "doi": "asdf;lds"}

    await async_auth_client.post("/api/studies/", data=my_second_study)


async def test_delete_studies(async_auth_client, ingest_neurosynth, session):
    study_db = Study.query.first()
    id_ = async_auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    study_db.user = user
    session.add(study_db)
    session.commit()

    get = await async_auth_client.get(f"/api/studies/{study_db.id}")

    await async_auth_client.delete(f"/api/studies/{study_db.id}")

    for analysis in get.json()["analyses"]:
        assert Analysis.query.filter_by(id=analysis).first() is None


async def test_production_study_query(async_auth_client, user_data, session):
    await async_auth_client.get(
        "/api/studies/?sort=name&page=1&desc=true&page_size=29999&nested=false&unique=true"
    )


@pytest.mark.skip("not supporting this feature anymore")
async def test_getting_studysets_by_owner(async_auth_clients, user_data, session):
    client1 = async_auth_clients[0]
    id1 = client1.username
    user_studysets_db = Studyset.query.filter_by(user_id=id1).all()
    all_studysets_db = Studyset.query.all()
    non_user_studysets_db = list(set(all_studysets_db) - set(user_studysets_db))
    all_studysets = await client1.get("/api/studies/")

    for study in all_studysets.json()["results"]:
        for studyset in study["studysets"]:
            assert studyset["id"] in [as_db.id for as_db in all_studysets_db]

    filtered_studysets = await client1.get(f"/api/studies/?studyset_owner={id1}")
    for study in filtered_studysets.json()["results"]:
        for studyset in study["studysets"]:
            assert studyset["id"] in [us_db.id for us_db in user_studysets_db]
            assert studyset["id"] not in [nus_db.id for nus_db in non_user_studysets_db]


@pytest.mark.parametrize("param", ["true", "false", "doi", "name", "pmid"])
async def test_get_unique_studies(async_auth_client, user_data, param, session):
    # clone a study owned by the user
    study_entry = Study.query.filter_by(user_id=async_auth_client.username).first()
    await async_auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={})
    resp = await async_auth_client.get(f"/api/studies/?unique={param}")
    assert resp.status_code == 200


async def test_cache_update(async_auth_client, user_data, session):
    study_entry = Study.query.filter_by(user_id=async_auth_client.username).first()
    await async_auth_client.get(f"/api/studies/{study_entry.id}")
    await async_auth_client.get(f"/api/studies/{study_entry.id}?nested=true")
    await async_auth_client.get(f"/api/studies/{study_entry.id}")
    await async_auth_client.put(f"/api/studies/{study_entry.id}", data={"name": "new name"})
    await async_auth_client.get(f"/api/studies/{study_entry.id}")


async def test_post_meta_analysis(async_auth_client, user_data, session):
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
    resp = await async_auth_client.post("/api/studies/", data=study_data)
    assert resp.status_code == 200


async def test_studies_flat(async_auth_client, ingest_neurosynth, session):
    flat_resp = await async_auth_client.get("/api/studies/?flat=true")
    reg_resp = await async_auth_client.get("/api/studies/?flat=false")

    assert flat_resp.status_code == reg_resp.status_code == 200

    assert "analyses" not in flat_resp.json()["results"][0]
    assert "analyses" in reg_resp.json()["results"][0]


async def test_create_study_new_user(async_new_user_client, mock_auth0_auth, session):

    study_resp = await async_new_user_client.post("/api/studies/", data={"name": "test"})
    assert study_resp.status_code == 200
