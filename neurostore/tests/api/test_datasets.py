

def test_post_and_get_datasets(auth_client, ingest_neurosynth):
    # create a dataset
    payload = auth_client.get('/api/studies/?search=priming').json
    nimads_data = {'dataset': payload}
    post_data = {
        "name": "rock road",
        "description": "mah ice cram",
        "nimads_data": nimads_data,
    }
    post_resp = auth_client.post("/api/datasets/", data=post_data)
    assert post_resp.status_code == 200

    get_resp = auth_client.get('/api/datasets/')

    assert get_resp.json[0] == post_resp.json