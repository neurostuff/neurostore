from ...models import Study, Analysis, User, Image


def test_get_images(auth_client, ingest_neurovault, session):
    # List of studysets
    resp = auth_client.get("/api/images/")
    assert resp.status_code == 200
    images_list = resp.json()["results"]

    assert isinstance(images_list, list)


def test_post_images(auth_client, session):
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    s = Study(
        name="fake", user=user, analyses=[Analysis(name="my analysis", user=user)]
    )
    session.add(s)
    session.commit()

    payload = {
        "url": "made up",
        "filename": "made up again",
        "analysis": s.analyses[0].id,
    }
    resp = auth_client.post("/api/images/", data=payload)

    assert resp.status_code == 200
    assert resp.json()["url"] == payload["url"]
    assert resp.json()["filename"] == payload["filename"]


def test_put_images(auth_client, session):
    id_ = auth_client.username
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
                ],
            )
        ],
    )
    session.add(s)
    session.commit()

    image_id = s.analyses[0].images[0].id
    new_data = {"url": "new fake"}
    resp = auth_client.put(f"/api/images/{image_id}", data=new_data)

    assert resp.json()["url"] == new_data["url"]


def test_delete_images(auth_client, session):
    id_ = auth_client.username
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
                ],
            )
        ],
    )
    session.add(s)
    session.commit()

    image_id = s.analyses[0].images[0].id
    auth_client.delete(f"/api/images/{image_id}")

    assert Image.query.filter_by(id=image_id).first() is None


def test_image_value_type_is_canonicalized_on_write(auth_client, session):
    user = User.query.filter_by(external_id=auth_client.username).first()
    study = Study(
        name="fake", user=user, analyses=[Analysis(name="my analysis", user=user)]
    )
    session.add(study)
    session.commit()

    payload = {
        "url": "made up",
        "filename": "made up again",
        "analysis": study.analyses[0].id,
        "value_type": "P map (given null hypothesis)",
    }
    resp = auth_client.post("/api/images/", data=payload)

    assert resp.status_code == 200
    assert resp.json()["value_type"] == "P map (given null hypothesis)"
    assert "value_type_label" not in resp.json()

    image = Image.query.filter_by(id=resp.json()["id"]).one()
    assert image.value_type == "P"


def test_image_value_type_is_canonicalized_on_read(auth_client, session):
    user = User.query.filter_by(external_id=auth_client.username).first()
    study = Study(
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
                        value_type="Z map",
                    )
                ],
            )
        ],
    )
    session.add(study)
    session.commit()

    image_id = study.analyses[0].images[0].id
    resp = auth_client.get(f"/api/images/{image_id}")

    assert resp.status_code == 200
    assert resp.json()["value_type"] == "Z map"
    assert "value_type_label" not in resp.json()
