"""Test Base Study Endpoint"""
from neurostore.models import BaseStudy


def test_flat_base_study(auth_client, ingest_neurosynth, session):
    flat_resp = auth_client.get("/api/base-studies/?flat=true")
    reg_resp = auth_client.get("/api/base-studies/?flat=false")

    assert flat_resp.status_code == reg_resp.status_code == 200

    assert "versions" not in flat_resp.json["results"][0]
    assert "versions" in reg_resp.json["results"][0]


def test_info_base_study(auth_client, ingest_neurosynth, session):
    info_resp = auth_client.get("/api/base-studies/?info=true")

    assert info_resp.status_code == 200

    assert "updated_at" in info_resp.json["results"][0]["versions"][0]


def test_has_coordinates_images(auth_client, session):
    # create an empty study
    doi = "abcd"
    pmid = "1234"
    create_study = auth_client.post(
        "/api/studies/",
        data={
            "name": "yeah",
            "pmid": "1234",
            "doi": "abcd",
            "analyses": [
                {
                    "name": "is this it?",
                },
            ],
        },
    )
    assert create_study.status_code == 200
    # get base study
    base_study = BaseStudy.query.filter_by(doi=doi, pmid=pmid).one()
    assert base_study.has_coordinates is False
    assert base_study.has_images is False

    # get the analysis
    analysis_id = create_study.json["analyses"][0]

    # update analysis with points
    analysis_point = auth_client.put(
        f"/api/analyses/{analysis_id}", data={"points": [{"x": 1, "y": 2, "z": 3}]}
    )

    assert analysis_point.status_code == 200
    assert base_study.has_coordinates is True

    # update analysis with points
    analysis_image = auth_client.put(
        f"/api/analyses/{analysis_id}", data={"images": [{"filename": "my_fake_image.nii.gz"}]}
    )

    assert analysis_image.status_code == 200
    assert base_study.has_images is True

    # delete point
    point_id = analysis_point.json["points"][0]

    del_point = auth_client.delete(f"/api/points/{point_id}")

    assert del_point.status_code == 200
    assert base_study.has_coordinates is False

    # delete image
    image_id = analysis_image.json["images"][0]

    del_image = auth_client.delete(f"/api/points/{image_id}")

    assert del_image.status_code == 200
    assert base_study.has_images is False
