from ...models import User


def test_create_user(auth_client):
    new_user = {
        'name': "fake name",
        'neuroid': '1234',
    }
    resp = auth_client.post("/api/users/", data=new_user)

    assert resp.status_code == 200
    assert User.query.filter_by(external_id='1234').first() is not None
