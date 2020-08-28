'''
Test basic views
'''


def test_login(auth_client):
    rv = auth_client.get('/login/')
    assert rv.status_code == 200
