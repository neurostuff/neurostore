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
    User,
)
from neurostore.schemas import StudySchema


def test_features_query(auth_client, ingest_demographic_features):
    """Test filtering features"""
    # Add OR functionality for multiple tasks (OR conditions)
    # flatten the features (flatten json objects)
    # test features organized like this: {top_key: ["list", "of", "values"]}
    result = auth_client.get(
        "/api/base-studies/?feature_filter="
        "ParticipantDemographicsExtractor:predictions.groups[].age_mean>10&"
        "feature_filter=ParticipantDemographicsExtractor:predictions.groups[].age_mean<=100&"
        "feature_display=ParticipantDemographicsExtractor&"
        "feature_flatten=true"
    )
    assert result.status_code == 200
    assert "features" in result.json()["results"][0]
    features = result.json()["results"][0]["features"][
        "ParticipantDemographicsExtractor"
    ]
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
        .join(  # Join with PipelineConfig and Pipeline to filter by pipeline name
            PipelineConfigAlias,
            PipelineStudyResultAlias.config_id == PipelineConfigAlias.id,
        )
        .join(
            PipelineAlias,
            PipelineConfigAlias.pipeline_id == PipelineAlias.id,
        )
        .filter(
            PipelineAlias.name == "ParticipantDemographicsExtractor"
        )  # Filter for specific pipeline
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
                >= latest_results.c.max_date_executed
            ),
        )
        .filter(PipelineAlias.name == "ParticipantDemographicsExtractor")
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
        "/api/base-studies/?feature_filter="
        "ParticipantDemographicsExtractor:predictions.groups[].diagnosis=ADHD|ASD&"
        "feature_display=ParticipantDemographicsExtractor&"
        "feature_flatten=true"
    )

    assert result.status_code == 200
    assert "features" in result.json()["results"][0]

    api_diagnoses = set()
    for res in result.json()["results"]:
        features = res["features"]["ParticipantDemographicsExtractor"]
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


def test_field_sanitization(auth_client):
    """Test sanitization of input fields in base studies"""
    test_input = [
        {
            "name": "Study with DOI prefix",
            "doi": "https://doi.org/10.1234/test",
            "pmcid": "12345",
        },
        {
            "name": "Study with dx DOI prefix",
            "doi": "https://dx.doi.org/10.5678/test",
            "pmcid": "PMC67890",  # Already has PMC prefix
        },
        {
            "name": "Study with whitespace fields",
            "doi": "   ",
            "pmid": "  ",
            "description": "  ",
        },
    ]

    result = auth_client.post("/api/base-studies/", data=test_input)
    assert result.status_code == 200

    created_studies = result.json()

    # Check DOI prefix removal
    assert created_studies[0]["doi"] == "10.1234/test"
    assert created_studies[1]["doi"] == "10.5678/test"

    # Check PMCID formatting
    assert created_studies[0]["pmcid"] == "PMC12345"
    assert created_studies[1]["pmcid"] == "PMC67890"  # Should remain unchanged

    # Check empty string conversion to None
    assert created_studies[2]["doi"] is None
    assert created_studies[2]["pmid"] is None
    assert created_studies[2]["description"] is None


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


def test_nested_base_study(auth_client, ingest_neurosynth, session):
    resp = auth_client.get("/api/base-studies/?nested=true")
    assert resp.status_code == 200

    first_result = resp.json()["results"][0]
    first_version = first_result["versions"][0]

    assert isinstance(first_version, dict)
    assert "username" in first_version
    assert "user" in first_version

    if first_version.get("analyses"):
        first_analysis = first_version["analyses"][0]
        assert isinstance(first_analysis, dict)
        assert "username" in first_analysis
        assert "user" in first_analysis


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

    # adding an analysis without media should not flip the flags back to False
    empty_analysis_resp = auth_client.post(
        "/api/analyses/",
        data={
            "study": create_full_study.json()["id"],
            "name": "empty analysis",
        },
    )
    assert empty_analysis_resp.status_code == 200
    session.refresh(base_study_2)
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


def test_filter_by_is_oa(auth_client, session):
    base_true = BaseStudy(
        name="Open Access Study",
        doi="10.1234/oa-study",
        pmid="111111",
        is_oa=True,
        public=True,
        level="group",
    )
    base_false = BaseStudy(
        name="Closed Access Study",
        doi="10.1234/closed-study",
        pmid="222222",
        is_oa=False,
        public=True,
        level="group",
    )
    base_unknown = BaseStudy(
        name="Unknown Access Study",
        doi="10.1234/unknown-study",
        pmid="333333",
        is_oa=None,
        public=True,
        level="group",
    )
    session.add_all([base_true, base_false, base_unknown])
    session.commit()

    assert session.query(BaseStudy).count() == 3

    all_resp = auth_client.get("/api/base-studies/")
    assert all_resp.status_code == 200
    all_names = {result["name"] for result in all_resp.json()["results"]}
    assert {
        "Open Access Study",
        "Closed Access Study",
        "Unknown Access Study",
    }.issubset(all_names)

    true_resp = auth_client.get("/api/base-studies/?is_oa=true")
    assert true_resp.status_code == 200
    true_results = true_resp.json()["results"]
    assert all(result["is_oa"] is True for result in true_results)
    true_names = {result["name"] for result in true_results}
    assert "Open Access Study" in true_names
    assert "Closed Access Study" not in true_names
    assert "Unknown Access Study" not in true_names

    false_resp = auth_client.get("/api/base-studies/?is_oa=false")
    assert false_resp.status_code == 200
    false_results = false_resp.json()["results"]
    assert all(result["is_oa"] is False for result in false_results)
    false_names = {result["name"] for result in false_results}
    assert "Closed Access Study" in false_names
    assert "Open Access Study" not in false_names
    assert "Unknown Access Study" not in false_names


def test_config_and_feature_filters(auth_client, ingest_demographic_features, session):
    """Test filtering by both config args and feature results with version specification"""
    # Test combined feature and config filtering
    response = auth_client.get(
        "/api/base-studies/?"
        "feature_filter=ParticipantDemographicsExtractor:1.0.0:predictions.groups[].age_mean>25&"
        "pipeline_config=ParticipantDemographicsExtractor:"
        "1.0.0:extractor_kwargs.extraction_model=gpt-4-turbo"
    )

    assert response.status_code == 200
    assert len(response.json()["results"]) > 0

    # Test with mismatched version
    response = auth_client.get(
        "/api/base-studies/?"
        "feature_filter=ParticipantDemographicsExtractor:2.0.0:predictions.groups[].age_mean>30&"
        "pipeline_config=ParticipantDemographicsExtractor:2.0.0:"
        "extractor_kwargs.extraction_model=gpt-4-turbo"
    )

    assert response.status_code == 200
    assert len(response.json()["results"]) == 0

    # Test error handling for invalid filter format
    response = auth_client.get(
        "/api/base-studies/?pipeline_config=ParticipantDemographicsExtractor:invalid:filter:format"
    )

    assert response.status_code == 400


def test_feature_display_and_pipeline_config(auth_client, ingest_demographic_features):
    """Test feature display and pipeline config parameters version matching and defaults"""
    # Test feature display with version specified
    response = auth_client.get(
        "/api/base-studies/?"
        "feature_display=ParticipantDemographicsExtractor:1.0.0&"
        "pipeline_config=ParticipantDemographicsExtractor:1.0.0:"
        "extractor_kwargs.extraction_model=gpt-4-turbo"
    )
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) > 0
    assert "features" in results[0]
    assert "ParticipantDemographicsExtractor" in results[0]["features"]

    # Test default behavior when version not specified (should use latest version)
    default_response = auth_client.get(
        "/api/base-studies/?"
        "feature_display=ParticipantDemographicsExtractor&"
        "pipeline_config=ParticipantDemographicsExtractor:"
        "extractor_kwargs.extraction_model=gpt-4-turbo"
    )
    assert default_response.status_code == 200
    assert len(default_response.json()["results"]) > 0

    # Verify the output structure
    result = default_response.json()["results"][0]
    assert "features" in result
    features = result["features"]["ParticipantDemographicsExtractor"]
    assert isinstance(features, dict)
    if "predictions" in features:
        assert isinstance(features["predictions"], dict)

    # Test mismatched versions between feature_display and pipeline_config
    mismatch_response = auth_client.get(
        "/api/base-studies/?"
        "feature_display=ParticipantDemographicsExtractor:1.0.0&"
        "pipeline_config=ParticipantDemographicsExtractor:2.0.0:model_version=2"
    )
    assert mismatch_response.status_code == 200
    assert len(mismatch_response.json()["results"]) == 0


def test_pipeline_config_with_quoted_value(auth_client, ingest_demographic_features):
    """Ensure quoted config filter values do not break jsonpath parsing."""
    quoted_resp = auth_client.get(
        "/api/base-studies/?"
        "pipeline_config=ParticipantDemographicsExtractor:1.0.0:"
        'extractor_kwargs.extraction_model="gpt-4-turbo"'
    )
    assert quoted_resp.status_code == 200

    unquoted_resp = auth_client.get(
        "/api/base-studies/?"
        "pipeline_config=ParticipantDemographicsExtractor:1.0.0:"
        "extractor_kwargs.extraction_model=gpt-4-turbo"
    )
    assert unquoted_resp.status_code == 200

    quoted_ids = {result["id"] for result in quoted_resp.json()["results"]}
    unquoted_ids = {result["id"] for result in unquoted_resp.json()["results"]}
    assert quoted_ids == unquoted_ids


def test_feature_flatten(auth_client, ingest_demographic_features):
    """Test flattening nested feature objects into dot notation"""
    # Get response without flattening
    unflattened = auth_client.get(
        "/api/base-studies/?feature_display=ParticipantDemographicsExtractor"
    )
    assert unflattened.status_code == 200

    # Get response with flattening
    flattened = auth_client.get(
        "/api/base-studies/?feature_display=ParticipantDemographicsExtractor&feature_flatten=true"
    )
    assert flattened.status_code == 200

    # Check that features exist in both responses
    assert "features" in unflattened.json()["results"][0]
    assert "features" in flattened.json()["results"][0]

    # Get the feature dictionaries
    unflattened_features = unflattened.json()["results"][0]["features"][
        "ParticipantDemographicsExtractor"
    ]
    flattened_features = flattened.json()["results"][0]["features"][
        "ParticipantDemographicsExtractor"
    ]

    # Verify features are flattened in dot notation
    # Check nested predictions.groups objects are flattened
    assert any(
        key.startswith("predictions.groups") for key in flattened_features.keys()
    )

    # Verify values are preserved after flattening
    # Example: predictions.groups[0].age_mean should equal the nested value
    if "predictions" in unflattened_features and unflattened_features[
        "predictions"
    ].get("groups"):
        nested_age = unflattened_features["predictions"]["groups"][0].get("age_mean")
        if nested_age is not None:
            flattened_age = flattened_features.get("predictions.groups[0].age_mean")
            assert nested_age == flattened_age


def test_invalid_search_query_cors(auth_client):
    """Test that invalid search query returns 400 with CORS headers"""
    result = auth_client.get("/api/base-studies/?search=AND+OR")
    assert result.status_code == 400
    assert "Access-Control-Allow-Origin" in result.headers
    assert "Access-Control-Allow-Methods" in result.headers
    assert "Access-Control-Allow-Headers" in result.headers
    assert result.headers["Access-Control-Allow-Origin"] == "*"


def test_base_studies_year_range(auth_client, session):
    # Create studies with different years
    user_id = auth_client.username
    user_obj = session.query(User).filter_by(external_id=user_id).first()
    years = [1999, 2005, 2010, 2020]
    for y in years:
        session.add(BaseStudy(name=f"YearStudy{y}", year=y, user=user_obj))
    session.commit()

    # Query with year_min
    resp = auth_client.get("/api/base-studies/?year_min=2005")
    results = resp.json().get("results", [])
    assert all(study["year"] >= 2005 for study in results)

    # Query with year_max
    resp = auth_client.get("/api/base-studies/?year_max=2010")
    results = resp.json().get("results", [])
    assert all(study["year"] <= 2010 for study in results)

    # Query with both
    resp = auth_client.get("/api/base-studies/?year_min=2005&year_max=2010")
    results = resp.json().get("results", [])
    assert all(2005 <= study["year"] <= 2010 for study in results)


def test_base_studies_spatial_query_with_mock_data(auth_client, session):
    """Test spatial filtering for base studies endpoint with mock data"""
    from neurostore.models import BaseStudy, Study, Analysis, Point

    # Create mock base study, study, analysis, and points
    base_study = BaseStudy(
        name="SpatialTest", has_coordinates=True, public=True, level="group"
    )
    session.add(base_study)
    session.flush()

    study = Study(name="SpatialStudy", base_study_id=base_study.id)
    session.add(study)
    session.flush()

    analysis = Analysis(name="SpatialAnalysis", study_id=study.id)
    session.add(analysis)
    session.flush()

    # Point within radius
    point1 = Point(x=10, y=20, z=30, analysis_id=analysis.id)
    # Point outside radius
    point2 = Point(x=100, y=200, z=300, analysis_id=analysis.id)
    session.add_all([point1, point2])
    session.commit()

    # Query for base studies with a point near (10, 20, 30) radius 15
    # Query for base studies with a point near (10, 20, 30) radius 15
    url = "/api/base-studies/?x=10&y=20&z=30&radius=15"
    result = auth_client.get(url)
    assert result.status_code == 200
    ids = [s["id"] for s in result.json()["results"]]
    assert base_study.id in ids


def test_base_studies_semantic_search(
    auth_client, mock_get_embedding, ingest_demographic_features
):
    """Query base-studies with semantic_search."""
    # have a very liberal distance threshold since arrays are randomly created.
    resp = auth_client.get(
        "/api/base-studies/?semantic_search='neural developmental disorders'&distance_threshold=1"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert isinstance(data["results"], list)
    if data["results"]:
        assert "id" in data["results"][0]

    # test with pipeline_config_id
    pipeline_config_id = PipelineConfig.query.filter_by(has_embeddings=True).first().id

    resp = auth_client.get(
        f"/api/base-studies/?semantic_search='neural developmental disorders'&"
        f"distance_threshold=1&pipeline_config_id={pipeline_config_id}"
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert isinstance(data["results"], list)
    if data["results"]:
        assert "id" in data["results"][0]


def test_is_active_filter_list(auth_client, session, ingest_neurostore):
    """Test that inactive base studies are filtered out from list view"""
    # Get a base study and mark it as inactive
    base_study = BaseStudy.query.first()
    assert base_study is not None

    # Store the ID for later
    inactive_id = base_study.id

    # Mark it as inactive
    base_study.is_active = False
    session.commit()

    # Try to list all base studies - should not include the inactive one
    resp = auth_client.get("/api/base-studies/")
    assert resp.status_code == 200
    data = resp.json()

    # Verify the inactive study is not in the results
    result_ids = [result["id"] for result in data["results"]]
    assert inactive_id not in result_ids

    # Create an active base study to verify active ones still appear
    active_study = BaseStudy(
        name="Active Test Study",
        doi="10.1234/active.test",
        pmid="99999999",
        is_active=True
    )
    session.add(active_study)
    session.commit()
    active_id = active_study.id

    # Verify the active study appears
    resp = auth_client.get("/api/base-studies/")
    assert resp.status_code == 200
    data = resp.json()
    result_ids = [result["id"] for result in data["results"]]
    assert active_id in result_ids
    assert inactive_id not in result_ids


def test_is_active_filter_get(auth_client, session, ingest_neurostore):
    """Test that inactive base studies CAN still be retrieved via direct link"""
    # Get a base study and mark it as inactive
    base_study = BaseStudy.query.first()
    assert base_study is not None

    # Store the ID
    inactive_id = base_study.id

    # First verify we can get it while active
    resp = auth_client.get(f"/api/base-studies/{inactive_id}")
    assert resp.status_code == 200

    # Mark it as inactive
    base_study.is_active = False
    session.commit()

    # Try to get the inactive base study via direct link - should still work (200)
    resp = auth_client.get(f"/api/base-studies/{inactive_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == inactive_id


def test_superseded_by_relationship(session):
    """Test that superseded_by creates a valid relationship"""
    # Create two base studies
    study1 = BaseStudy(
        name="Old Study",
        doi="10.1234/old.study",
        pmid="11111111",
        is_active=False
    )
    study2 = BaseStudy(
        name="New Study",
        doi="10.1234/new.study",
        pmid="22222222",
        is_active=True
    )
    session.add(study1)
    session.add(study2)
    session.commit()

    # Link study1 to study2
    study1.superseded_by = study2.id
    session.commit()

    # Verify the relationship
    assert study1.superseded_by == study2.id
    assert study1.superseded_by_study.id == study2.id

    # Verify study2 has study1 in its supersedes backref
    assert study1 in study2.supersedes


def test_superseded_by_no_self_reference(session):
    """Test that a base study cannot supersede itself"""
    from sqlalchemy.exc import IntegrityError

    study = BaseStudy(
        name="Self Reference Study",
        doi="10.1234/self.ref",
        pmid="33333333",
    )
    session.add(study)
    session.commit()

    # Try to set superseded_by to itself - should fail
    study.superseded_by = study.id

    try:
        session.commit()
        assert False, "Should have raised IntegrityError"
    except IntegrityError:
        session.rollback()
        # Expected behavior


def test_is_active_not_exposed_in_api(auth_client, ingest_neurostore):
    """Test that is_active and superseded_by are not exposed in API responses"""
    # Get a base study
    resp = auth_client.get("/api/base-studies/")
    assert resp.status_code == 200
    data = resp.json()

    if data["results"]:
        result = data["results"][0]
        # Verify internal fields are not exposed
        assert "is_active" not in result
        assert "superseded_by" not in result
