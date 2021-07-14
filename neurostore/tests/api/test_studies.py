import pytest

from ..request_utils import decode_json
from ...models.data import Study


def test_get_studies(auth_client, ingest_neurosynth):
    # List of studies
    resp = auth_client.get("/api/studies/")
    assert resp.status_code == 200
    studies_list = decode_json(resp)

    assert type(studies_list) == list

    assert len(studies_list) == 1

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

    assert full_study["doi"] == "10.1016/S0896-6273(00)80456-0"

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
    payload = {**data, 'id': study_clone_id}
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


def test_clone_studies(auth_client, ingest_neurosynth):
    study_entry = Study.query.first()
    resp = auth_client.post(f"/api/studies/?source_id={study_entry.id}", data={})
    data = resp.json
    assert data['name'] == study_entry.name
    assert data['source_id'] == study_entry.id
    assert data['source'] == 'neurostore'
    assert data['analyses'][0]['name'] == study_entry.analyses[0].name

    # a clone of a clone should reference the original parent
    resp2 = auth_client.post(f"/api/studies/?source_id={data['id']}", data={})
    data2 = resp2.json

    assert data2['name'] == study_entry.name
    assert data2['source_id'] == study_entry.id
    assert data2['source'] == 'neurostore'
    assert data2['analyses'][0]['name'] == study_entry.analyses[0].name
