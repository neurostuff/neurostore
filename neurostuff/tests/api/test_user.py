import datetime
from ...models.auth import User
from ..request_utils import decode_json


def test_get(auth_client):
    time = datetime.datetime.now()
    resp = auth_client.get('/api/user')
    assert resp.status_code == 200
    assert 'email' in decode_json(resp)

    user = User.query.filter_by(email=decode_json(resp)['email']).one()
    assert user.last_activity_at > time
    assert user.last_activity_ip is not None
