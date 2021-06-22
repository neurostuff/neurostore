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


def test_put_studies(auth_client, ingest_neurosynth):
    study_entry = Study.query.first()
    study_clone_id = auth_client.post(f"/api/studies/?source_id={study_entry.id}").json['id']
    payload = {'metadata': {"cool": "important detail"}, 'id': study_clone_id}
    put_resp = auth_client.put(f"/api/studies/{study_clone_id}", data=payload)
    assert put_resp.status_code == 200

    updated_study_entry = Study.query.filter_by(id=study_clone_id).first()

    assert put_resp.json["metadata"] == updated_study_entry.metadata_


def test_clone_studies(auth_client, ingest_neurosynth):
    study_entry = Study.query.first()
    resp = auth_client.post(f"/api/studies/?source_id={study_entry.id}")
    data = resp.json
    assert data['name'] == study_entry.name
    assert data['source_id'] == study_entry.id
    assert data['source'] == 'neurostore'
    assert data['analyses'][0]['name'] == study_entry.analyses[0].name
