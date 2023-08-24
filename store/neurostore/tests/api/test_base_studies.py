"""Test Base Study Endpoint"""
from neurostore.models import BaseStudy, Analysis


def test_flat_base_study(auth_client, ingest_neurosynth, session):
    flat_resp = auth_client.get("/api/base-studies/?flat=true")
    reg_resp = auth_client.get("/api/base-studies/?flat=false")

    assert flat_resp.status_code == reg_resp.status_code == 200

    assert "versions" not in flat_resp.json["results"][0]
    assert "versions" in reg_resp.json["results"][0]


def test_info_base_study(auth_client, ingest_neurosynth, session):
    info_resp = auth_client.get("/api/base-studies/?info=true")
    reg_resp = auth_client.get("/api/base-studies/?info=false")

    assert info_resp.status_code == 200
    assert reg_resp.status_code == 200

    assert "updated_at" in info_resp.json["results"][0]["versions"][0]
    assert isinstance(reg_resp.json["results"][0]["versions"][0], str)

    # test specific base-study
    base_study_id = reg_resp.json["results"][0]["id"]
    single_info_resp = auth_client.get(f"/api/base-studies/{base_study_id}?info=true")
    single_reg_resp = auth_client.get(f"/api/base-studies/{base_study_id}?info=false")

    assert single_info_resp.status_code == 200
    assert single_reg_resp.status_code == 200

    assert "updated_at" in single_info_resp.json["versions"][0]
    assert isinstance(single_reg_resp.json["versions"][0], str)


def test_has_coordinates_images(auth_client, session):
    # create an empty study
    doi_a = "abcd"
    doi_b = "efgh"
    pmid_a = "1234"
    pmid_b = "5678"
    study_a_data = {
        "name": "yeah",
        "pmid": pmid_a,
        "doi": doi_a,
    }
    study_b_data = {
        "name": "nah",
        "pmid": pmid_b,
        "doi": doi_b,
    }

    analysis_a_data = {"name": "is this it?"}
    analysis_b_data = {"name": "this is it"}

    point_a_data = {"x": 1, "y": 2, "z": 3}
    point_b_data = {"x": 10, "y": 9, "z": 8}

    image_a_data = {"filename": "my_fake_image.nii.gz"}
    image_b_data = {"filename": "my_morefaker_image.nii.gz"}
    create_study = auth_client.post(
        "/api/studies/",
        data={
            **study_a_data,
            **{
                "analyses": [
                    analysis_a_data,
                ],
            },
        },
    )
    assert create_study.status_code == 200
    # get base study
    base_study = BaseStudy.query.filter_by(doi=doi_a, pmid=pmid_a).one()
    assert base_study.has_coordinates is False
    assert base_study.has_images is False

    # get the analysis
    analysis_id = create_study.json["analyses"][0]

    # update analysis with points
    analysis_point = auth_client.put(
        f"/api/analyses/{analysis_id}", data={"points": [point_a_data]}
    )

    assert analysis_point.status_code == 200
    assert base_study.has_coordinates is True

    # update analysis with points
    analysis_image = auth_client.put(
        f"/api/analyses/{analysis_id}",
        data={"images": [image_a_data]},
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

    del_image = auth_client.delete(f"/api/images/{image_id}")

    assert del_image.status_code == 200
    assert base_study.has_images is False

    # create study with existing points and images
    create_full_study = auth_client.post(
        "/api/studies/",
        data={
            **study_b_data,
            **{
                "analyses": [
                    {
                        **analysis_a_data,
                        **{"images": [image_a_data, image_b_data]},
                    },
                    {
                        **analysis_b_data,
                        **{"points": [point_a_data, point_b_data]},
                    },
                ],
            },
        },
    )

    assert create_full_study.status_code == 200
    # get base study
    base_study_2 = BaseStudy.query.filter_by(doi=doi_b, pmid=pmid_b).one()
    assert base_study_2.has_coordinates is True
    assert base_study_2.has_images is True

    # delete analysis a
    analysis_ids = create_full_study.json["analyses"]
    analyses = [Analysis.query.filter_by(id=id_).one() for id_ in analysis_ids]

    point_analysis = image_analysis = None
    for analysis in analyses:
        if analysis.points:
            point_analysis = analysis
        if analysis.images:
            image_analysis = analysis

    del_one_point = auth_client.delete(f"/api/points/{point_analysis.points[0].id}")
    assert del_one_point.status_code == 200
    assert base_study_2.has_coordinates is True
    assert base_study_2.has_images is True

    del_point_analysis = auth_client.delete(f"/api/analyses/{point_analysis.id}")

    assert del_point_analysis.status_code == 200
    assert base_study_2.has_coordinates is False
    assert base_study_2.has_images is True

    del_image_analysis = auth_client.delete(f"/api/analyses/{image_analysis.id}")

    assert del_image_analysis.status_code == 200
    assert base_study_2.has_coordinates is False
    assert base_study_2.has_images is False

    # create full study again
    create_full_study_again = auth_client.post(
        "/api/studies/",
        data={
            **study_b_data,
            **{
                "analyses": [
                    {
                        **analysis_a_data,
                        **{"images": [image_a_data, image_b_data]},
                    },
                    {
                        **analysis_b_data,
                        **{"points": [point_a_data, point_b_data]},
                    },
                ],
            },
        },
    )

    assert create_full_study_again.status_code == 200
    assert base_study_2.has_coordinates is True
    assert base_study_2.has_images is True

    # delete the full study
    delete_study = auth_client.delete(
        f"/api/studies/{create_full_study_again.json['id']}"
    )

    assert delete_study.status_code == 200
    assert base_study_2.has_coordinates is False
    assert base_study_2.has_images is False
