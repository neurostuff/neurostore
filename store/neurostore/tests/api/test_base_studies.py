"""Test Base Study Endpoint"""

from sqlalchemy import text
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func


from neurostore.models import (
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
    BaseStudy,
    Analysis,
)
from neurostore.schemas import StudySchema


def test_features_query(auth_client, ingest_demographic_features):
    """Test filtering features"""
    # Add OR functionality for multiple tasks (OR conditions)
    # flatten the features (flatten json objects)
    # test features organized like this: {top_key: ["list", "of", "values"]}
    result = auth_client.get(
        (
            "/api/base-studies/?feature_filter=ParticipantInfo:predictions.groups[].age_mean>10&"
            "feature_filter=ParticipantInfo:predictions.groups[].age_mean<=100&"
            "feature_display=ParticipantInfo"
        )
    )
    assert result.status_code == 200
    assert "features" in result.json()["results"][0]
    features = result.json()["results"][0]["features"]["ParticipantInfo"]
    assert any(
        key.startswith("predictions") and key.endswith("].age_mean") for key in features
    )


def test_features_query_with_or(auth_client, ingest_demographic_features, session):
    # First check diagnoses directly from database

    PipelineStudyResultAlias = aliased(PipelineStudyResult)
    PipelineConfigAlias = aliased(PipelineConfig)
    PipelineAlias = aliased(Pipeline)

    # Get most recent results for each base study
    latest_results = (
        session.query(
            PipelineStudyResultAlias.base_study_id,
            func.max(PipelineStudyResultAlias.date_executed).label("max_date_executed"),
        )
        .group_by(PipelineStudyResultAlias.base_study_id)
        .subquery()
    )

    # Query the database directly using jsonpath
    db_query = (
        session.query(PipelineStudyResultAlias)
        .join(
            PipelineConfigAlias,
            PipelineStudyResultAlias.config_id == PipelineConfigAlias.id,
        )
        .join(PipelineAlias, PipelineConfigAlias.pipeline_id == PipelineAlias.id)
        .join(
            latest_results,
            (PipelineStudyResultAlias.base_study_id == latest_results.c.base_study_id)
            & (
                PipelineStudyResultAlias.date_executed
                == latest_results.c.max_date_executed
            ),
        )
        .filter(PipelineAlias.name == "ParticipantInfo")
        .filter(
            text(
                "jsonb_path_exists(result_data, '$.predictions.groups[*].diagnosis ?"
                ' (@ == "ADHD" || @ == "ASD")\')'
            )
        )
    )

    db_diagnoses = set()
    for result in db_query.all():
        for group in result.result_data["predictions"]["groups"]:
            if "diagnosis" in group:
                db_diagnoses.add(group["diagnosis"])

    # Now make the API request
    result = auth_client.get(
        (
            "/api/base-studies/?feature_filter="
            "ParticipantInfo:predictions.groups[].diagnosis=ADHD|ASD&"
            "feature_display=ParticipantInfo"
        )
    )

    assert result.status_code == 200
    assert "features" in result.json()["results"][0]

    api_diagnoses = set()
    for res in result.json()["results"]:
        features = res["features"]["ParticipantInfo"]
        # Get all diagnosis values from flattened structure
        diagnoses = [v for k, v in features.items() if k.endswith(".diagnosis")]
        api_diagnoses.update(diagnoses)

    # Compare database and API results
    assert db_diagnoses == api_diagnoses


def test_post_list_of_studies(auth_client, ingest_neuroquery):
    base_studies = BaseStudy.query.all()
    test_input = [
        {
            "pmid": base_studies[0].pmid,
        },
        {
            "name": base_studies[2].name,
        },
        {
            "doi": "new_doi",
            "name": "new name",
        },
        {
            "pmid": base_studies[1].pmid,
            "doi": "",
        },
        {
            "name": "another new name",
        },
        {
            "doi": "",
            "pmid": "",
            "name": "no ids",
        },
    ]

    result = auth_client.post("/api/base-studies/", data=test_input)

    assert result.status_code == 200


def test_flat_base_study(auth_client, ingest_neurosynth, session):
    flat_resp = auth_client.get("/api/base-studies/?flat=true")
    reg_resp = auth_client.get("/api/base-studies/?flat=false")

    assert flat_resp.status_code == reg_resp.status_code == 200

    assert "versions" not in flat_resp.json()["results"][0]
    assert "versions" in reg_resp.json()["results"][0]


def test_info_base_study(auth_client, ingest_neurosynth, session):
    info_resp = auth_client.get("/api/base-studies/?info=true")
    reg_resp = auth_client.get("/api/base-studies/?info=false")

    assert info_resp.status_code == 200
    assert reg_resp.status_code == 200

    assert "updated_at" in info_resp.json()["results"][0]["versions"][0]
    assert isinstance(reg_resp.json()["results"][0]["versions"][0], str)

    # test specific base-study
    base_study_id = reg_resp.json()["results"][0]["id"]
    single_info_resp = auth_client.get(f"/api/base-studies/{base_study_id}?info=true")
    single_reg_resp = auth_client.get(f"/api/base-studies/{base_study_id}?info=false")

    assert single_info_resp.status_code == 200
    assert single_reg_resp.status_code == 200

    info_fields = [
        f
        for f, v in StudySchema._declared_fields.items()
        if v.metadata.get("info_field")
    ]

    study = single_info_resp.json()["versions"][0]

    for f in info_fields:
        assert f in study

    assert isinstance(single_reg_resp.json()["versions"][0], str)


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
    analysis_id = create_study.json()["analyses"][0]

    # update analysis with points
    analysis_point = auth_client.put(
        f"/api/analyses/{analysis_id}", data={"points": [point_a_data]}
    )

    assert analysis_point.status_code == 200
    session.refresh(base_study)
    assert base_study.has_coordinates is True

    # update analysis with points
    analysis_image = auth_client.put(
        f"/api/analyses/{analysis_id}",
        data={"images": [image_a_data]},
    )

    assert analysis_image.status_code == 200
    session.refresh(base_study)
    assert base_study.has_images is True

    # delete point
    point_id = analysis_point.json()["points"][0]

    del_point = auth_client.delete(f"/api/points/{point_id}")

    assert del_point.status_code == 200
    session.refresh(base_study)
    assert base_study.has_coordinates is False

    # delete image
    image_id = analysis_image.json()["images"][0]

    del_image = auth_client.delete(f"/api/images/{image_id}")

    assert del_image.status_code == 200
    session.refresh(base_study)
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
    analysis_ids = create_full_study.json()["analyses"]
    analyses = [Analysis.query.filter_by(id=id_).one() for id_ in analysis_ids]

    point_analysis = image_analysis = None
    for analysis in analyses:
        if analysis.points:
            point_analysis = analysis
        if analysis.images:
            image_analysis = analysis

    del_one_point = auth_client.delete(f"/api/points/{point_analysis.points[0].id}")
    assert del_one_point.status_code == 200
    session.refresh(base_study_2)
    assert base_study_2.has_coordinates is True
    assert base_study_2.has_images is True

    del_point_analysis = auth_client.delete(f"/api/analyses/{point_analysis.id}")

    assert del_point_analysis.status_code == 200
    session.refresh(base_study_2)
    assert base_study_2.has_coordinates is False
    assert base_study_2.has_images is True

    del_image_analysis = auth_client.delete(f"/api/analyses/{image_analysis.id}")

    assert del_image_analysis.status_code == 200
    session.refresh(base_study_2)
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
    session.refresh(base_study_2)
    assert base_study_2.has_coordinates is True
    assert base_study_2.has_images is True

    # delete the full study
    delete_study = auth_client.delete(
        f"/api/studies/{create_full_study_again.json()['id']}"
    )

    assert delete_study.status_code == 200
    session.refresh(base_study_2)
    assert base_study_2.has_coordinates is False
    assert base_study_2.has_images is False

def test_feature_flatten(auth_client, ingest_demographic_features):
    """Test flattening nested feature objects into dot notation"""
    # Get response without flattening
    unflattened = auth_client.get(
        "/api/base-studies/?feature_display=ParticipantInfo"
    )
    assert unflattened.status_code == 200
    
    # Get response with flattening
    flattened = auth_client.get(
        "/api/base-studies/?feature_display=ParticipantInfo&feature_flatten=true"
    )
    assert flattened.status_code == 200

    # Check that features exist in both responses
    assert "features" in unflattened.json()["results"][0]
    assert "features" in flattened.json()["results"][0]

    # Get the feature dictionaries
    unflattened_features = unflattened.json()["results"][0]["features"]["ParticipantInfo"]
    flattened_features = flattened.json()["results"][0]["features"]["ParticipantInfo"]

    # Verify features are flattened in dot notation
    # Check nested predictions.groups objects are flattened
    assert any(
        key.startswith("predictions.groups") for key in flattened_features.keys()
    )

    # Verify values are preserved after flattening
    # Example: predictions.groups[0].age_mean should equal the nested value
    nested_age = unflattened_features["predictions"]["groups"][0]["age_mean"]
    flattened_age = flattened_features["predictions.groups[0].age_mean"]
    assert nested_age == flattened_age
