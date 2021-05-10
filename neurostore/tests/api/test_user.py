from ...models.auth import User


def test_create_user(auth_client):
    new_user = {
        'email': 'this@that.com',
        'name': "fake name",
        'username': 'user',
        'password': 'more than six characters'
    }
    auth_client.post("/api/register", data=new_user)
    user = User.query.filter_by(email=new_user['email'])
    login_resp = auth_client.post("/api/login", data={'email': new_user['email'], 'password': new_user['password']})
