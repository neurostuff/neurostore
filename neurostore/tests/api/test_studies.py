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
    for k in ["analysis", "created_at", "doi", "name"]:
        assert k in full_study

    assert full_study["doi"] == "10.1016/S0896-6273(00)80456-0"

    assert full_study["id"] == s_id


def test_put_studies(auth_client, ingest_neurosynth):
    study_entry = Study.query.first()
    payload = auth_client.get(f"/api/studies/{study_entry.id}?nested=true").json
    # payload = auth_client.get(f"/api/studies/{study_entry.id}").json
    payload.pop("created_at")
    payload["metadata"] = {"cool": "important detail"}
    [(pl.pop("created_at"), pl.pop("study")) for pl in payload["analysis"]]
    [
        (p.pop("created_at"), p.pop("analysis"))
        for pl in payload["analysis"]
        for p in pl["point"]
    ]
    put_resp = auth_client.put(f"/api/studies/{study_entry.id}", data=payload)
    assert put_resp.status_code == 200

    updated_study_entry = Study.query.filter_by(id=study_entry.id).first()

    assert put_resp.json["metadata"] == updated_study_entry.metadata_


def test_clone_studies(auth_client, ingest_neurosynth):
    study_entry = Study.query.first()
    auth_client.post(f"/api/studies/?clone={study_entry.id}")
