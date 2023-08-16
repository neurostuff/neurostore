"""Test Base Study Endpoint"""


def test_flat_base_study(auth_client, ingest_neurosynth, session):
    flat_resp = auth_client.get("/api/base-studies/?flat=true")
    reg_resp = auth_client.get("/api/base-studies/?flat=false")

    assert flat_resp.status_code == reg_resp.status_code == 200

    assert "versions" not in flat_resp.json["results"][0]
    assert "versions" in reg_resp.json["results"][0]


def test_info_base_study(auth_client, ingest_neurosynth, session):
    info_resp = auth_client.get("/api/base-studies/?info=true")

    assert info_resp.status_code == 200

    assert "updated_at" in info_resp.json["results"][0]["versions"][0]
