import pytest

from ..request_utils import decode_json
from ...models.data import Study


def test_get_studies(auth_client, ingest_neurosynth, ingest_neuroquery):
    # List of studies
    resp = auth_client.get("/api/studies/?nested=true")
    assert resp.status_code == 200
    studies_list = decode_json(resp)['results']

    assert type(studies_list) == list

    assert len(studies_list) == resp.json['metadata']['total_count']

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
        {'metadata': {"cool": "important detail"}},
        {"analyses": [{"conditions": [{"name": "face"}, {"name": "house"}], "weights": [-1, 1]}]},
    ]
)
def test_put_studies(auth_client, ingest_neurosynth, data):
    study_entry = Study.query.first()
    study_clone = auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={}).json
    study_clone_id = study_clone['id']
    payload = data
    if payload.get('analyses'):
        if payload['analyses'][0].get("conditions"):
            conditions = []
            for cond in payload['analyses'][0]['conditions']:
                conditions.append(auth_client.post("/api/conditions/", data=cond).json)
            payload['analyses'][0]['conditions'] = [{'id': cond['id']} for cond in conditions]
        analysis_clone_id = study_clone['analyses'][0]['id']
        payload['analyses'][0]['id'] = analysis_clone_id
    put_resp = auth_client.put(f"/api/studies/{study_clone_id}", data=payload)
    assert put_resp.status_code == 200

    updated_study_entry = Study.query.filter_by(id=study_clone_id).first()

    assert put_resp.json["metadata"] == updated_study_entry.metadata_


def test_clone_studies(auth_client, ingest_neurosynth, ingest_neurovault):
    study_entry = Study.query.filter(Study.metadata_.isnot(None)).first()
    resp = auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={})
    data = resp.json
    assert data['name'] == study_entry.name
    assert data['source_id'] == study_entry.id
    assert data['source'] == 'neurostore'
    assert set([an['name'] for an in data['analyses']]) ==\
           set([an.name for an in study_entry.analyses])

    # a clone of a clone should reference the original parent
    resp2 = auth_client.post(f"/api/studies/?source_id={data['id']}", data={})
    data2 = resp2.json

    assert data2['name'] == study_entry.name
    assert data2['source_id'] == study_entry.id
    assert data2['source'] == 'neurostore'
    assert set([an['name'] for an in data2['analyses']]) ==\
           set([an.name for an in study_entry.analyses])


def test_private_studies(user_studies, auth_clients):
    from ...resources.auth import decode_token
    from ...resources.users import User
    client1, client2 = auth_clients
    user1 = User.query.filter_by(external_id=decode_token(client1.token)['sub']).first()
    user2 = User.query.filter_by(external_id=decode_token(client2.token)['sub']).first()
    resp1 = client1.get("/api/studies/")
    resp2 = client2.get("/api/studies/")
    name_set1 = set(s['name'] for s in resp1.json['results'])
    name_set2 = set(s['name'] for s in resp2.json['results'])
    assert len(resp1.json['results']) == len(resp2.json['results']) == 3
    assert f"{user1.id}'s private study" in (name_set1 - name_set2)
    assert f"{user2.id}'s private study" in (name_set2 - name_set1)


def test_post_studies(auth_client, ingest_neurosynth):
    payload = auth_client.get("/api/analyses/").json['results']
    analyses = [analysis['id'] for analysis in payload]
    my_study = {
        "name": "bomb",
        "description": "diggity",
        "analyses": analyses,
    }

    auth_client.post(f"/api/studies/", data=my_study)
