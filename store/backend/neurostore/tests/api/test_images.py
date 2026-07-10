from neurostore.models import Analysis, BaseStudy, Image, Study, User


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
    assert resp.json()["study"] == s.id


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


def test_post_uncategorized_image_with_study(auth_client, session):
    user = User.query.filter_by(external_id=auth_client.username).first()
    study = Study(name="study-owned image", user=user)
    session.add(study)
    session.commit()

    resp = auth_client.post(
        "/api/images/",
        data={
            "filename": "uncategorized-z.nii.gz",
            "study": study.id,
            "value_type": "Z map",
        },
    )

    assert resp.status_code == 200
    assert resp.json()["study"] == study.id
    assert resp.json()["analysis"] is None

    image = Image.query.filter_by(id=resp.json()["id"]).one()
    assert image.study_id == study.id
    assert image.analysis_id is None


def test_get_images_filters_by_study(auth_client, session):
    user = User.query.filter_by(external_id=auth_client.username).first()
    study_a = Study(name="study a", user=user)
    study_b = Study(name="study b", user=user)
    analysis_a = Analysis(name="analysis a", study=study_a, user=user)
    categorized = Image(
        filename="categorized.nii.gz",
        study=study_a,
        analysis=analysis_a,
        user=user,
    )
    uncategorized = Image(filename="uncategorized.nii.gz", study=study_a, user=user)
    other_study = Image(filename="other.nii.gz", study=study_b, user=user)
    session.add_all(
        [study_a, study_b, analysis_a, categorized, uncategorized, other_study]
    )
    session.commit()

    resp = auth_client.get(f"/api/images/?study={study_a.id}")

    assert resp.status_code == 200
    image_ids = {image["id"] for image in resp.json()["results"]}
    assert categorized.id in image_ids
    assert uncategorized.id in image_ids
    assert other_study.id not in image_ids


def test_image_analysis_sets_and_validates_study(auth_client, session):
    user = User.query.filter_by(external_id=auth_client.username).first()
    study_a = Study(name="analysis image study a", user=user)
    study_b = Study(name="analysis image study b", user=user)
    analysis_a = Analysis(name="analysis a", study=study_a, user=user)
    session.add_all([study_a, study_b, analysis_a])
    session.commit()

    resp = auth_client.post(
        "/api/images/",
        data={
            "filename": "categorized.nii.gz",
            "analysis": analysis_a.id,
        },
    )

    assert resp.status_code == 200
    assert resp.json()["analysis"] == analysis_a.id
    assert resp.json()["study"] == study_a.id

    mismatch = auth_client.post(
        "/api/images/",
        data={
            "filename": "mismatch.nii.gz",
            "analysis": analysis_a.id,
            "study": study_b.id,
        },
    )
    assert mismatch.status_code == 422


def test_clearing_image_analysis_preserves_study(auth_client, session):
    user = User.query.filter_by(external_id=auth_client.username).first()
    study = Study(name="clear analysis study", user=user)
    analysis = Analysis(name="analysis", study=study, user=user)
    image = Image(
        filename="clear-analysis.nii.gz",
        study=study,
        analysis=analysis,
        user=user,
    )
    session.add_all([study, analysis, image])
    session.commit()

    resp = auth_client.put(f"/api/images/{image.id}", data={"analysis": None})

    assert resp.status_code == 200
    assert resp.json()["analysis"] is None
    assert resp.json()["study"] == study.id
    session.refresh(image)
    assert image.analysis_id is None
    assert image.study_id == study.id


def test_deleting_analysis_uncategorizes_images(auth_client, session):
    create_study = auth_client.post(
        "/api/studies/",
        data={
            "name": "analysis delete image study",
            "doi": "10.5555/analysis-delete-image",
            "analyses": [
                {
                    "name": "image analysis",
                    "images": [{"filename": "analysis-owned.nii.gz"}],
                }
            ],
        },
    )
    assert create_study.status_code == 200
    study_id = create_study.json()["id"]
    analysis_id = create_study.json()["analyses"][0]
    image_id = Analysis.query.filter_by(id=analysis_id).one().images[0].id

    resp = auth_client.delete(f"/api/analyses/{analysis_id}")

    assert resp.status_code == 200
    session.expire_all()
    image = Image.query.filter_by(id=image_id).one()
    assert image.analysis_id is None
    assert image.study_id == study_id


def test_uncategorized_image_updates_study_flags(auth_client, session):
    create_study = auth_client.post(
        "/api/studies/",
        data={
            "name": "uncategorized image flags",
            "doi": "10.5555/uncategorized-image-flags",
        },
    )
    assert create_study.status_code == 200
    study_id = create_study.json()["id"]
    base_study = BaseStudy.query.filter_by(
        doi="10.5555/uncategorized-image-flags"
    ).one()

    resp = auth_client.post(
        "/api/images/",
        data={
            "study": study_id,
            "filename": "uncategorized-z-map.nii.gz",
            "value_type": "Z map",
        },
    )

    assert resp.status_code == 200
    session.refresh(base_study)
    study = Study.query.filter_by(id=study_id).one()
    assert study.has_images is True
    assert study.has_z_maps is True
    assert base_study.has_images is True
    assert base_study.has_z_maps is True


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
