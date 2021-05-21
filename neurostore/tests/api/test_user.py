def test_create_user(auth_client):
    new_user = {
        'email': 'this@that.com',
        'name': "fake name",
        'username': 'user',
        'password': 'more than six characters'
    }
    auth_client.post("/api/register", data=new_user)
    login_resp = auth_client.post(
        "/api/login",
        data={
            'email': new_user['email'],
            'password': new_user['password'],
        }
    )

    assert login_resp.status_code == 200
    assert 'access_token' in login_resp.json.keys()
