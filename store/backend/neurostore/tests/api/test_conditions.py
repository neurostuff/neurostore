def test_get_conditions(auth_client, ingest_neurovault, session):
    resp = auth_client.get("/api/conditions/")
    assert resp.status_code == 200
    assert len(resp.json()["results"]) > 1


def test_post_conditions(auth_client, ingest_neurovault, session):
    my_condition = {"name": "ice cream", "description": "surprise, it's rocky road!"}
    post_resp = auth_client.post("/api/conditions/", data=my_condition)
    assert post_resp.status_code == 200
    post_data = post_resp.json()
    get_data = auth_client.get(f"/api/conditions/{post_data['id']}").json()
    for attr in my_condition.keys():
        assert post_data[attr] == get_data[attr] == my_condition[attr]


def test_put_conditions():
    pass
