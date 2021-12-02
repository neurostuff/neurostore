from ..request_utils import decode_json
from ...models import Study, Analysis, User, Image
from ...resources.auth import decode_token


def test_get_images(auth_client, ingest_neurovault):
    # List of datasets
    resp = auth_client.get("/api/images/")
    assert resp.status_code == 200
    images_list = decode_json(resp)['results']

    assert type(images_list) == list


def test_post_images(auth_client, session):
    id_ = decode_token(auth_client.token)['sub']
    user = User.query.filter_by(external_id=id_).first()
    s = Study(
        name="fake",
        user=user,
        analyses=[Analysis(name="my analysis", user=user)]
    )
    session.add(s)
    session.commit()

    payload = {
        'url': 'made up',
        'filename': 'made up again',
        'analysis': s.analyses[0].id,
    }
    resp = auth_client.post("/api/images/", data=payload)

    assert resp.status_code == 200
    assert resp.json['url'] == payload['url']
    assert resp.json['filename'] == payload['filename']


def test_put_images(auth_client, session):
    id_ = decode_token(auth_client.token)['sub']
    user = User.query.filter_by(external_id=id_).first()
    s = Study(
        name="fake",
        user=user,
        analyses=[
            Analysis(
                name="my analysis",
                user=user,
                images=[
                    Image(
                        filename="fake",
                        url="also fake",
                        user=user,
                    )
                ]
            )
        ]
    )
    session.add(s)
    session.commit()

    image_id = s.analyses[0].images[0].id
    new_data = {'metadata': {'this': 'is'}}
    resp = auth_client.put(f"/api/images/{image_id}", data=new_data)

    assert resp.json['metadata'] == new_data['metadata']


def test_delete_images(auth_client, session):
    id_ = decode_token(auth_client.token)['sub']
    user = User.query.filter_by(external_id=id_).first()
    s = Study(
        name="fake",
        user=user,
        analyses=[
            Analysis(
                name="my analysis",
                user=user,
                images=[
                    Image(
                        filename="fake",
                        url="also fake",
                        user=user,
                    )
                ]
            )
        ]
    )
    session.add(s)
    session.commit()

    image_id = s.analyses[0].images[0].id
    auth_client.delete(f"/api/images/{image_id}")

    assert Image.query.filter_by(id=image_id).first() is None
