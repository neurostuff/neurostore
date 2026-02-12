"""Test Base Study Endpoint"""

import datetime as dt

from sqlalchemy import text
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from neurostore.models import (
    Pipeline,
    PipelineConfig,
    PipelineStudyResult,
    PipelineEmbedding,
    BaseStudy,
    BaseStudyFlagOutbox,
    BaseStudyMetadataOutbox,
    Analysis,
    Image,
    Study,
    User,
)
from neurostore.schemas import StudySchema
from neurostore.services.has_media_flags import process_base_study_flag_outbox_batch
from neurostore.services.base_study_metadata_enrichment import (
    enqueue_base_study_metadata_updates,
    process_base_study_metadata_outbox_batch,
)


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


def test_filter_base_study_by_public_and_private_neurovault_ids(auth_client, session):
    user = session.query(User).first()
    public_base_study = BaseStudy(name="Public Neurovault Filter Study", level="group")
    private_base_study = BaseStudy(
        name="Private Neurovault Filter Study", level="group"
    )
    public_study = Study(
        name="Public Neurovault Study Version",
        level="group",
        source="neurovault",
        source_id="19125",
        base_study=public_base_study,
        user=user,
    )
    private_study = Study(
        name="Private Neurovault Study Version",
        level="group",
        source="neurovault",
        source_id="private-collection-token-abc123",
        base_study=private_base_study,
        user=user,
    )
    session.add_all(
        [public_base_study, private_base_study, public_study, private_study]
    )
    session.commit()

    public_filter = auth_client.get("/api/base-studies/?neurovault_id=19125")
    private_filter = auth_client.get(
        "/api/base-studies/?neurovault_id=private-collection-token-abc123"
    )

    assert public_filter.status_code == 200
    assert private_filter.status_code == 200
    assert public_base_study.id in {r["id"] for r in public_filter.json()["results"]}
    assert private_base_study.id in {r["id"] for r in private_filter.json()["results"]}


def test_filter_base_study_by_neurovault_id(auth_client, session):
    user = session.query(User).first()
    base_study = BaseStudy(name="Neurovault Filter Study", level="group", user=user)
    study = Study(
        name="Neurovault-backed Study Version",
        level="group",
        source="neurovault",
        source_id="nv-filter-0001",
        base_study=base_study,
        user=user,
    )
    session.add_all([base_study, study])
    session.commit()

    filter_resp = auth_client.get("/api/base-studies/?neurovault_id=nv-filter-0001")
    assert filter_resp.status_code == 200

    result_ids = {result["id"] for result in filter_resp.json()["results"]}
    assert base_study.id in result_ids


def test_multiple_neurovault_collections_share_base_study(auth_client, session):
    payload_common = {
        "name": "Same Paper Multiple Neurovault Collections",
        "level": "group",
        "doi": "10.9999/same-paper-multi-collection",
        "pmid": "999002",
        "pmcid": "PMC999002",
    }
    first_resp = auth_client.post("/api/studies/", data=payload_common)
    second_resp = auth_client.post("/api/studies/", data=payload_common)

    assert first_resp.status_code == 200
    assert second_resp.status_code == 200
    assert first_resp.json()["id"] != second_resp.json()["id"]

    first_study = session.query(Study).filter_by(id=first_resp.json()["id"]).one()
    second_study = session.query(Study).filter_by(id=second_resp.json()["id"]).one()
    first_study.source = "neurovault"
    first_study.source_id = "nv-dup-1"
    second_study.source = "neurovault"
    second_study.source_id = "nv-dup-2"
    session.commit()

    assert first_study.base_study_id == second_study.base_study_id
    shared_base_study_id = first_study.base_study_id

    by_doi = auth_client.get(
        "/api/base-studies/?doi=10.9999/same-paper-multi-collection"
    )
    assert by_doi.status_code == 200
    doi_ids = {result["id"] for result in by_doi.json()["results"]}
    assert shared_base_study_id in doi_ids

    by_nv_1 = auth_client.get("/api/base-studies/?neurovault_id=nv-dup-1")
    by_nv_2 = auth_client.get("/api/base-studies/?neurovault_id=nv-dup-2")
    assert by_nv_1.status_code == 200
    assert by_nv_2.status_code == 200
    assert shared_base_study_id in {r["id"] for r in by_nv_1.json()["results"]}
    assert shared_base_study_id in {r["id"] for r in by_nv_2.json()["results"]}


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


def test_base_study_emits_all_media_flags(auth_client, session):
    create_study = auth_client.post(
        "/api/studies/",
        data={
            "name": "base-study-media-flags",
            "pmid": "910001",
            "doi": "10.1000/base-study-media-flags",
            "analyses": [
                {
                    "name": "analysis-media-flags",
                    "images": [
                        {"filename": "z-map.nii.gz", "value_type": "Z map"},
                        {"filename": "t-map.nii.gz", "value_type": "T"},
                        {"filename": "beta-map.nii.gz", "value_type": "U"},
                        {"filename": "variance-map.nii.gz", "value_type": "V"},
                    ],
                }
            ],
        },
    )
    assert create_study.status_code == 200

    base_study = BaseStudy.query.filter_by(
        pmid="910001", doi="10.1000/base-study-media-flags"
    ).one()
    response = auth_client.get(f"/api/base-studies/{base_study.id}")
    assert response.status_code == 200
    payload = response.json()

    assert payload["has_coordinates"] is False
    assert payload["has_images"] is True
    assert payload["has_z_maps"] is True
    assert payload["has_t_maps"] is True
    assert payload["has_beta_and_variance_maps"] is True


def test_async_image_reassignment_updates_hierarchy_flags(auth_client, session, app):
    async_original = app.config.get("BASE_STUDY_FLAGS_ASYNC", False)
    app.config["BASE_STUDY_FLAGS_ASYNC"] = True

    try:
        doi_a = "10.1000/async-flags-a"
        doi_b = "10.1000/async-flags-b"
        pmid_a = "900001"
        pmid_b = "900002"

        create_study_a = auth_client.post(
            "/api/studies/",
            data={
                "name": "async flags study a",
                "pmid": pmid_a,
                "doi": doi_a,
                "analyses": [
                    {
                        "name": "analysis a",
                        "images": [{"filename": "image-a.nii.gz"}],
                    }
                ],
            },
        )
        create_study_b = auth_client.post(
            "/api/studies/",
            data={
                "name": "async flags study b",
                "pmid": pmid_b,
                "doi": doi_b,
                "analyses": [
                    {
                        "name": "analysis b",
                    }
                ],
            },
        )

        assert create_study_a.status_code == 200
        assert create_study_b.status_code == 200

        analysis_a_id = create_study_a.json()["analyses"][0]
        analysis_b_id = create_study_b.json()["analyses"][0]

        analysis_a_resp = auth_client.get(f"/api/analyses/{analysis_a_id}")
        assert analysis_a_resp.status_code == 200
        image_id = analysis_a_resp.json()["images"][0]

        base_study_a = BaseStudy.query.filter_by(doi=doi_a, pmid=pmid_a).one()
        base_study_b = BaseStudy.query.filter_by(doi=doi_b, pmid=pmid_b).one()
        study_a = Study.query.filter_by(id=create_study_a.json()["id"]).one()
        study_b = Study.query.filter_by(id=create_study_b.json()["id"]).one()
        analysis_a = Analysis.query.filter_by(id=analysis_a_id).one()
        analysis_b = Analysis.query.filter_by(id=analysis_b_id).one()

        queued_before_move = {
            row.base_study_id for row in BaseStudyFlagOutbox.query.all()
        }
        assert base_study_a.id in queued_before_move
        assert base_study_b.id in queued_before_move

        move_image = auth_client.put(
            f"/api/images/{image_id}", data={"analysis": analysis_b_id}
        )
        assert move_image.status_code == 200

        queued_after_move = {
            row.base_study_id for row in BaseStudyFlagOutbox.query.all()
        }
        assert base_study_a.id in queued_after_move
        assert base_study_b.id in queued_after_move

        for _ in range(10):
            processed = process_base_study_flag_outbox_batch(batch_size=200)
            if processed == 0:
                break

        session.refresh(base_study_a)
        session.refresh(base_study_b)
        session.refresh(study_a)
        session.refresh(study_b)
        session.refresh(analysis_a)
        session.refresh(analysis_b)

        assert analysis_a.has_images is False
        assert analysis_b.has_images is True
        assert analysis_a.has_coordinates is False
        assert analysis_b.has_coordinates is False

        assert study_a.has_images is False
        assert study_b.has_images is True
        assert study_a.has_coordinates is False
        assert study_b.has_coordinates is False

        assert base_study_a.has_images is False
        assert base_study_b.has_images is True
        assert base_study_a.has_coordinates is False
        assert base_study_b.has_coordinates is False
    finally:
        app.config["BASE_STUDY_FLAGS_ASYNC"] = async_original


def test_async_worker_map_type_flag_transitions(auth_client, session, app):
    async_original = app.config.get("BASE_STUDY_FLAGS_ASYNC", False)
    app.config["BASE_STUDY_FLAGS_ASYNC"] = True

    def drain_outbox():
        for _ in range(20):
            processed = process_base_study_flag_outbox_batch(batch_size=200)
            if processed == 0:
                break

    def refresh_all(*records):
        for record in records:
            session.refresh(record)

    try:
        create_study_a = auth_client.post(
            "/api/studies/",
            data={
                "name": "worker-map-flags-a",
                "pmid": "920001",
                "doi": "10.1000/worker-map-flags-a",
                "analyses": [
                    {
                        "name": "analysis-a",
                        "images": [
                            {"filename": "beta-a.nii.gz", "value_type": "U"},
                            {"filename": "variance-a.nii.gz", "value_type": "V"},
                        ],
                    }
                ],
            },
        )
        create_study_b = auth_client.post(
            "/api/studies/",
            data={
                "name": "worker-map-flags-b",
                "pmid": "920002",
                "doi": "10.1000/worker-map-flags-b",
                "analyses": [{"name": "analysis-b"}],
            },
        )

        assert create_study_a.status_code == 200
        assert create_study_b.status_code == 200

        analysis_a_id = create_study_a.json()["analyses"][0]
        analysis_b_id = create_study_b.json()["analyses"][0]

        analysis_a = Analysis.query.filter_by(id=analysis_a_id).one()
        analysis_b = Analysis.query.filter_by(id=analysis_b_id).one()
        study_a = Study.query.filter_by(id=create_study_a.json()["id"]).one()
        study_b = Study.query.filter_by(id=create_study_b.json()["id"]).one()
        base_study_a = BaseStudy.query.filter_by(
            doi="10.1000/worker-map-flags-a", pmid="920001"
        ).one()
        base_study_b = BaseStudy.query.filter_by(
            doi="10.1000/worker-map-flags-b", pmid="920002"
        ).one()

        drain_outbox()
        refresh_all(
            analysis_a, analysis_b, study_a, study_b, base_study_a, base_study_b
        )

        # Initial state: analysis_a has beta+variance maps, analysis_b has none.
        assert analysis_a.has_beta_and_variance_maps is True
        assert study_a.has_beta_and_variance_maps is True
        assert base_study_a.has_beta_and_variance_maps is True
        assert analysis_b.has_beta_and_variance_maps is False
        assert study_b.has_beta_and_variance_maps is False
        assert base_study_b.has_beta_and_variance_maps is False

        beta_image = Image.query.filter_by(
            analysis_id=analysis_a_id, filename="beta-a.nii.gz"
        ).one()
        variance_image = Image.query.filter_by(
            analysis_id=analysis_a_id, filename="variance-a.nii.gz"
        ).one()

        # variance removed => beta only => has_beta_and_variance_maps should be false
        delete_variance = auth_client.delete(f"/api/images/{variance_image.id}")
        assert delete_variance.status_code == 200
        drain_outbox()
        refresh_all(analysis_a, study_a, base_study_a)
        assert analysis_a.has_beta_and_variance_maps is False
        assert study_a.has_beta_and_variance_maps is False
        assert base_study_a.has_beta_and_variance_maps is False

        # add variance back => true again
        add_variance = auth_client.post(
            "/api/images/",
            data={
                "analysis": analysis_a_id,
                "filename": "variance-a-2.nii.gz",
                "value_type": "variance",
            },
        )
        assert add_variance.status_code == 200
        variance_image_2_id = add_variance.json()["id"]
        drain_outbox()
        refresh_all(analysis_a, study_a, base_study_a)
        assert analysis_a.has_beta_and_variance_maps is True
        assert study_a.has_beta_and_variance_maps is True
        assert base_study_a.has_beta_and_variance_maps is True

        # move variance away => old scope beta-only false, new scope variance-only false
        move_variance = auth_client.put(
            f"/api/images/{variance_image_2_id}", data={"analysis": analysis_b_id}
        )
        assert move_variance.status_code == 200
        drain_outbox()
        refresh_all(
            analysis_a, analysis_b, study_a, study_b, base_study_a, base_study_b
        )
        assert analysis_a.has_beta_and_variance_maps is False
        assert study_a.has_beta_and_variance_maps is False
        assert base_study_a.has_beta_and_variance_maps is False
        assert analysis_b.has_beta_and_variance_maps is False
        assert study_b.has_beta_and_variance_maps is False
        assert base_study_b.has_beta_and_variance_maps is False

        # move beta too => new scope has both => true
        move_beta = auth_client.put(
            f"/api/images/{beta_image.id}", data={"analysis": analysis_b_id}
        )
        assert move_beta.status_code == 200
        drain_outbox()
        refresh_all(
            analysis_a, analysis_b, study_a, study_b, base_study_a, base_study_b
        )
        assert analysis_a.has_beta_and_variance_maps is False
        assert study_a.has_beta_and_variance_maps is False
        assert base_study_a.has_beta_and_variance_maps is False
        assert analysis_b.has_beta_and_variance_maps is True
        assert study_b.has_beta_and_variance_maps is True
        assert base_study_b.has_beta_and_variance_maps is True

        # add z and t maps to analysis_b and validate z/t flags
        add_z = auth_client.post(
            "/api/images/",
            data={
                "analysis": analysis_b_id,
                "filename": "z-b.nii.gz",
                "value_type": "Z",
            },
        )
        add_t = auth_client.post(
            "/api/images/",
            data={
                "analysis": analysis_b_id,
                "filename": "t-b.nii.gz",
                "value_type": "T map",
            },
        )
        assert add_z.status_code == 200
        assert add_t.status_code == 200
        z_image_id = add_z.json()["id"]

        drain_outbox()
        refresh_all(analysis_b, study_b, base_study_b)
        assert analysis_b.has_z_maps is True
        assert analysis_b.has_t_maps is True
        assert study_b.has_z_maps is True
        assert study_b.has_t_maps is True
        assert base_study_b.has_z_maps is True
        assert base_study_b.has_t_maps is True

        # move z map from b -> a and validate old/new scope transitions
        move_z = auth_client.put(
            f"/api/images/{z_image_id}", data={"analysis": analysis_a_id}
        )
        assert move_z.status_code == 200
        drain_outbox()
        refresh_all(
            analysis_a, analysis_b, study_a, study_b, base_study_a, base_study_b
        )
        assert analysis_a.has_z_maps is True
        assert study_a.has_z_maps is True
        assert base_study_a.has_z_maps is True
        assert analysis_b.has_z_maps is False
        assert study_b.has_z_maps is False
        assert base_study_b.has_z_maps is False
    finally:
        app.config["BASE_STUDY_FLAGS_ASYNC"] = async_original


def test_base_study_create_enqueues_metadata_outbox(auth_client, app):
    async_original = app.config.get("BASE_STUDY_METADATA_ASYNC", False)
    app.config["BASE_STUDY_METADATA_ASYNC"] = True
    try:
        response = auth_client.post(
            "/api/base-studies/",
            data={
                "name": "metadata-enqueue-study",
                "pmid": "930001",
                "level": "group",
            },
        )
        assert response.status_code == 200

        outbox_entry = BaseStudyMetadataOutbox.query.filter_by(
            base_study_id=response.json()["id"]
        ).one_or_none()
        assert outbox_entry is not None
    finally:
        app.config["BASE_STUDY_METADATA_ASYNC"] = async_original


def test_base_study_bulk_create_enqueues_metadata_outbox(auth_client, app):
    async_original = app.config.get("BASE_STUDY_METADATA_ASYNC", False)
    app.config["BASE_STUDY_METADATA_ASYNC"] = True
    try:
        response = auth_client.post(
            "/api/base-studies/",
            data=[
                {
                    "name": "metadata-enqueue-study-bulk",
                    "pmid": "930002",
                    "level": "group",
                }
            ],
        )
        assert response.status_code == 200
        assert len(response.json()) == 1

        outbox_entry = BaseStudyMetadataOutbox.query.filter_by(
            base_study_id=response.json()[0]["id"]
        ).one_or_none()
        assert outbox_entry is not None
    finally:
        app.config["BASE_STUDY_METADATA_ASYNC"] = async_original


def test_metadata_worker_merges_duplicates_and_keeps_existing_metadata(
    session, app, monkeypatch
):
    from neurostore.services import base_study_metadata_enrichment as metadata_service

    primary = BaseStudy(
        name="Curated Title",
        pmid="940001",
        level="group",
    )
    duplicate = BaseStudy(
        name="Duplicate Title",
        doi="10.1000/metadata-merge",
        level="group",
    )
    primary_study = Study(
        name="primary-study-version",
        level="group",
        base_study=primary,
    )
    duplicate_study = Study(
        name="duplicate-study-version",
        level="group",
        base_study=duplicate,
    )
    now = dt.datetime.now(dt.timezone.utc)
    primary.created_at = now - dt.timedelta(seconds=10)
    duplicate.created_at = now
    session.add_all([primary, duplicate, primary_study, duplicate_study])
    session.commit()

    session.add(
        BaseStudyMetadataOutbox(
            base_study_id=primary.id,
            reason="test-enrichment",
        )
    )
    session.commit()

    def fake_lookup_semantic(_identifiers, api_key=None):
        return {"doi": "10.1000/metadata-merge", "pmcid": "PMC940001"}

    def fake_lookup_pubmed(_identifiers, email=None, api_key=None, tool=None):
        return {"pmcid": "PMC940001"}

    def fake_lookup_openalex(_identifiers, email=None):
        return {"doi": "10.1000/metadata-merge"}

    def fake_metadata_semantic(_identifiers, api_key=None):
        return {
            "name": "Provider Title Should Not Override",
            "description": "Provider abstract",
            "publication": "Provider Journal",
            "authors": "Provider A, Provider B",
            "year": 2025,
            "is_oa": True,
            "doi": "10.1000/metadata-merge",
            "pmcid": "PMC940001",
        }

    def fake_metadata_pubmed(_identifiers, email=None, api_key=None, tool=None):
        return {"publication": "PubMed Journal", "year": 2024}

    captured_cache_ids = []

    monkeypatch.setattr(
        metadata_service, "lookup_ids_semantic_scholar", fake_lookup_semantic
    )
    monkeypatch.setattr(metadata_service, "lookup_ids_pubmed", fake_lookup_pubmed)
    monkeypatch.setattr(metadata_service, "lookup_ids_openalex", fake_lookup_openalex)
    monkeypatch.setattr(
        metadata_service, "fetch_metadata_semantic_scholar", fake_metadata_semantic
    )
    monkeypatch.setattr(metadata_service, "fetch_metadata_pubmed", fake_metadata_pubmed)
    monkeypatch.setattr(
        metadata_service,
        "bump_cache_versions",
        lambda unique_ids: captured_cache_ids.append(unique_ids),
    )

    processed = process_base_study_metadata_outbox_batch(batch_size=10)
    assert processed == 1

    session.refresh(primary)
    session.refresh(duplicate)
    session.refresh(primary_study)
    session.refresh(duplicate_study)

    # Older record remains canonical and preserves curated metadata.
    assert primary.name == "Curated Title"
    assert primary.doi == "10.1000/metadata-merge"
    assert primary.pmcid == "PMC940001"
    assert primary.description == "Provider abstract"
    assert primary.publication == "Provider Journal"
    assert primary.authors == "Provider A, Provider B"
    assert primary.year == 2025
    assert primary.is_oa is True

    # Newer duplicate is superseded and all versions are merged into canonical.
    assert duplicate.is_active is False
    assert duplicate.superseded_by == primary.id
    assert primary_study.base_study_id == primary.id
    assert duplicate_study.base_study_id == primary.id

    assert (
        BaseStudyMetadataOutbox.query.filter_by(base_study_id=primary.id).one_or_none()
        is None
    )
    assert (
        BaseStudyMetadataOutbox.query.filter_by(
            base_study_id=duplicate.id
        ).one_or_none()
        is None
    )
    assert BaseStudyFlagOutbox.query.filter_by(base_study_id=primary.id).first()

    assert captured_cache_ids, "Expected metadata worker to invalidate cache versions"
    assert any(
        primary.id in ids.get("base-studies", set()) for ids in captured_cache_ids
    )
    assert any(
        duplicate_study.id in ids.get("studies", set()) for ids in captured_cache_ids
    )


def test_metadata_worker_merge_avoids_doi_pmid_unique_conflict(session, monkeypatch):
    from neurostore.services import base_study_metadata_enrichment as metadata_service

    primary = BaseStudy(
        name="Primary Record",
        doi="10.2000/unique-merge",
        level="group",
    )
    duplicate = BaseStudy(
        name="Duplicate Record",
        doi="10.2000/unique-merge",
        pmid="950001",
        level="group",
    )
    now = dt.datetime.now(dt.timezone.utc)
    primary.created_at = now - dt.timedelta(seconds=10)
    duplicate.created_at = now
    session.add_all([primary, duplicate])
    session.commit()

    session.add(
        BaseStudyMetadataOutbox(
            base_study_id=primary.id,
            reason="test-unique-merge",
        )
    )
    session.commit()

    monkeypatch.setattr(
        metadata_service, "lookup_ids_semantic_scholar", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service, "lookup_ids_pubmed", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service, "lookup_ids_openalex", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service,
        "fetch_metadata_semantic_scholar",
        lambda *_args, **_kwargs: {},
    )
    monkeypatch.setattr(
        metadata_service, "fetch_metadata_pubmed", lambda *_args, **_kwargs: {}
    )

    processed = process_base_study_metadata_outbox_batch(batch_size=10)
    assert processed == 1

    session.refresh(primary)
    session.refresh(duplicate)
    assert primary.pmid == "950001"
    assert duplicate.is_active is False
    assert duplicate.superseded_by == primary.id
    assert (
        BaseStudyMetadataOutbox.query.filter_by(base_study_id=primary.id).one_or_none()
        is None
    )


def test_metadata_worker_merge_reassigns_pipeline_rows(
    session, ingest_demographic_features, monkeypatch
):
    from neurostore.services import base_study_metadata_enrichment as metadata_service

    primary = (
        session.query(BaseStudy)
        .join(PipelineStudyResult, PipelineStudyResult.base_study_id == BaseStudy.id)
        .join(PipelineEmbedding, PipelineEmbedding.base_study_id == BaseStudy.id)
        .first()
    )
    assert primary is not None

    shared_identifier = None
    identifier_field = None
    for field in ("pmid", "doi", "pmcid"):
        value = getattr(primary, field)
        if value:
            shared_identifier = value
            identifier_field = field
            break
    assert shared_identifier is not None, "Expected seeded base study to have an identifier"

    duplicate_kwargs = {
        "name": "Pipeline Duplicate",
        "level": "group",
        identifier_field: shared_identifier,
    }
    duplicate = BaseStudy(**duplicate_kwargs)
    session.add(duplicate)
    session.commit()

    # Ensure the seeded study remains canonical during duplicate merge.
    now = dt.datetime.now(dt.timezone.utc)
    primary.created_at = now - dt.timedelta(seconds=10)
    duplicate.created_at = now
    session.commit()

    pipeline_result = (
        session.query(PipelineStudyResult)
        .filter(PipelineStudyResult.base_study_id == primary.id)
        .first()
    )
    pipeline_embedding = (
        session.query(PipelineEmbedding)
        .filter(PipelineEmbedding.base_study_id == primary.id)
        .first()
    )
    assert pipeline_result is not None
    assert pipeline_embedding is not None

    pipeline_result_id = pipeline_result.id
    pipeline_embedding_id = pipeline_embedding.id
    pipeline_embedding_config_id = pipeline_embedding.config_id

    pipeline_result.base_study_id = duplicate.id
    pipeline_embedding.base_study_id = duplicate.id
    session.commit()

    session.add(
        BaseStudyMetadataOutbox(
            base_study_id=duplicate.id,
            reason="test-pipeline-row-reassign",
        )
    )
    session.commit()

    monkeypatch.setattr(
        metadata_service, "lookup_ids_semantic_scholar", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service, "lookup_ids_pubmed", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service, "lookup_ids_openalex", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service, "fetch_metadata_semantic_scholar", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service, "fetch_metadata_pubmed", lambda *_args, **_kwargs: {}
    )

    processed = process_base_study_metadata_outbox_batch(batch_size=10)
    assert processed == 1

    session.refresh(primary)
    session.refresh(duplicate)
    assert duplicate.is_active is False
    assert duplicate.superseded_by == primary.id

    reassigned_result = (
        session.query(PipelineStudyResult)
        .filter(PipelineStudyResult.id == pipeline_result_id)
        .one()
    )
    reassigned_embedding = (
        session.query(PipelineEmbedding)
        .filter(
            PipelineEmbedding.id == pipeline_embedding_id,
            PipelineEmbedding.config_id == pipeline_embedding_config_id,
        )
        .one()
    )
    assert reassigned_result.base_study_id == primary.id
    assert reassigned_embedding.base_study_id == primary.id

    assert (
        session.query(PipelineStudyResult)
        .filter(
            PipelineStudyResult.id == pipeline_result_id,
            PipelineStudyResult.base_study_id == duplicate.id,
        )
        .count()
        == 0
    )
    assert (
        session.query(PipelineEmbedding)
        .filter(
            PipelineEmbedding.id == pipeline_embedding_id,
            PipelineEmbedding.config_id == pipeline_embedding_config_id,
            PipelineEmbedding.base_study_id == duplicate.id,
        )
        .count()
        == 0
    )


def test_metadata_worker_defers_failed_rows(session, app, monkeypatch):
    from neurostore.services import base_study_metadata_enrichment as metadata_service

    delay_original = app.config.get("BASE_STUDY_METADATA_RETRY_DELAY_SECONDS", "30")
    app.config["BASE_STUDY_METADATA_RETRY_DELAY_SECONDS"] = "120"
    try:
        base_study = BaseStudy(
            name="Retry Row",
            pmid="960001",
            level="group",
        )
        session.add(base_study)
        session.commit()

        old_updated_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)
        session.add(
            BaseStudyMetadataOutbox(
                base_study_id=base_study.id,
                reason="test-retry-delay",
                updated_at=old_updated_at,
            )
        )
        session.commit()

        monkeypatch.setattr(
            metadata_service,
            "enrich_base_study_metadata",
            lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
        )

        processed = process_base_study_metadata_outbox_batch(batch_size=10)
        assert processed == 0

        outbox_entry = BaseStudyMetadataOutbox.query.filter_by(
            base_study_id=base_study.id
        ).one()
        assert outbox_entry.updated_at > old_updated_at
    finally:
        app.config["BASE_STUDY_METADATA_RETRY_DELAY_SECONDS"] = delay_original


def test_metadata_worker_stops_after_first_satisfied_provider(session, monkeypatch):
    from neurostore.services import base_study_metadata_enrichment as metadata_service

    base_study = BaseStudy(
        name=None,
        pmid="980001",
        level="group",
    )
    session.add(base_study)
    session.commit()

    session.add(
        BaseStudyMetadataOutbox(
            base_study_id=base_study.id,
            reason="test-provider-short-circuit",
        )
    )
    session.commit()

    call_counts = {
        "lookup_pubmed": 0,
        "lookup_openalex": 0,
        "fetch_pubmed": 0,
    }

    monkeypatch.setattr(
        metadata_service,
        "lookup_ids_semantic_scholar",
        lambda *_args, **_kwargs: {
            "doi": "10.9800/short-circuit",
            "pmcid": "PMC980001",
        },
    )

    def _unexpected_lookup_pubmed(*_args, **_kwargs):
        call_counts["lookup_pubmed"] += 1
        return {}

    def _unexpected_lookup_openalex(*_args, **_kwargs):
        call_counts["lookup_openalex"] += 1
        return {}

    monkeypatch.setattr(
        metadata_service, "lookup_ids_pubmed", _unexpected_lookup_pubmed
    )
    monkeypatch.setattr(
        metadata_service, "lookup_ids_openalex", _unexpected_lookup_openalex
    )
    monkeypatch.setattr(
        metadata_service,
        "fetch_metadata_semantic_scholar",
        lambda *_args, **_kwargs: {
            "name": "Semantic Title",
            "description": "Semantic abstract",
            "publication": "Semantic Journal",
            "authors": "Author A, Author B",
            "year": 2023,
            "is_oa": True,
            "doi": "10.9800/short-circuit",
            "pmid": "980001",
            "pmcid": "PMC980001",
        },
    )

    def _unexpected_fetch_pubmed(*_args, **_kwargs):
        call_counts["fetch_pubmed"] += 1
        return {}

    monkeypatch.setattr(
        metadata_service, "fetch_metadata_pubmed", _unexpected_fetch_pubmed
    )

    processed = process_base_study_metadata_outbox_batch(batch_size=10)
    assert processed == 1

    session.refresh(base_study)
    assert base_study.doi == "10.9800/short-circuit"
    assert base_study.pmcid == "PMC980001"
    assert base_study.name == "Semantic Title"
    assert base_study.publication == "Semantic Journal"
    assert base_study.authors == "Author A, Author B"
    assert base_study.year == 2023
    assert base_study.is_oa is True

    assert call_counts["lookup_pubmed"] == 0
    assert call_counts["lookup_openalex"] == 0
    assert call_counts["fetch_pubmed"] == 0


def test_metadata_worker_propagates_metadata_to_study_versions(session, monkeypatch):
    from neurostore.services import base_study_metadata_enrichment as metadata_service

    base_study = BaseStudy(
        name=None,
        pmid="990010",
        level="group",
    )
    version_missing = Study(
        name=None,
        publication=None,
        authors=None,
        year=None,
        doi=None,
        pmid=None,
        pmcid=None,
        level="group",
        base_study=base_study,
    )
    version_curated = Study(
        name="Curated Study Title",
        publication=None,
        authors="Curated Author",
        year=None,
        doi="10.7777/curated",
        pmid=None,
        pmcid=None,
        level="group",
        base_study=base_study,
    )
    session.add_all([base_study, version_missing, version_curated])
    session.commit()

    session.add(
        BaseStudyMetadataOutbox(
            base_study_id=base_study.id,
            reason="test-study-version-propagation",
        )
    )
    session.commit()

    monkeypatch.setattr(
        metadata_service,
        "lookup_ids_semantic_scholar",
        lambda *_args, **_kwargs: {
            "doi": "10.9900/propagate",
            "pmcid": "PMC990010",
        },
    )
    monkeypatch.setattr(
        metadata_service, "lookup_ids_pubmed", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service, "lookup_ids_openalex", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service,
        "fetch_metadata_semantic_scholar",
        lambda *_args, **_kwargs: {
            "name": "Provider Title",
            "description": "Provider abstract",
            "publication": "Provider Journal",
            "authors": "Provider Author",
            "year": 2024,
            "is_oa": True,
            "doi": "10.9900/propagate",
            "pmid": "990010",
            "pmcid": "PMC990010",
        },
    )
    monkeypatch.setattr(
        metadata_service, "fetch_metadata_pubmed", lambda *_args, **_kwargs: {}
    )

    captured_cache_ids = []
    monkeypatch.setattr(
        metadata_service,
        "bump_cache_versions",
        lambda unique_ids: captured_cache_ids.append(unique_ids),
    )

    processed = process_base_study_metadata_outbox_batch(batch_size=10)
    assert processed == 1

    session.refresh(base_study)
    session.refresh(version_missing)
    session.refresh(version_curated)

    assert base_study.name == "Provider Title"
    assert base_study.description == "Provider abstract"
    assert base_study.publication == "Provider Journal"
    assert base_study.authors == "Provider Author"
    assert base_study.year == 2024
    assert base_study.doi == "10.9900/propagate"
    assert base_study.pmcid == "PMC990010"

    assert version_missing.name == "Provider Title"
    assert version_missing.publication == "Provider Journal"
    assert version_missing.authors == "Provider Author"
    assert version_missing.year == 2024
    assert version_missing.doi == "10.9900/propagate"
    assert version_missing.pmid == "990010"
    assert version_missing.pmcid == "PMC990010"

    # Existing version metadata remains unchanged.
    assert version_curated.name == "Curated Study Title"
    assert version_curated.authors == "Curated Author"
    assert version_curated.doi == "10.7777/curated"
    # Missing fields still get backfilled.
    assert version_curated.publication == "Provider Journal"
    assert version_curated.year == 2024
    assert version_curated.pmid == "990010"
    assert version_curated.pmcid == "PMC990010"

    assert captured_cache_ids, "Expected metadata worker to invalidate cache versions"
    assert any(
        version_missing.id in ids.get("studies", set()) for ids in captured_cache_ids
    )
    assert any(
        version_curated.id in ids.get("studies", set()) for ids in captured_cache_ids
    )


def test_metadata_worker_treats_year_zero_as_missing(session, monkeypatch):
    from neurostore.services import base_study_metadata_enrichment as metadata_service

    base_study = BaseStudy(
        name="Existing Name",
        description="Existing Description",
        publication="Existing Journal",
        authors="Existing Author",
        year=0,
        is_oa=True,
        pmid="990020",
        doi="10.9900/year-zero",
        pmcid="PMC990020",
        level="group",
    )
    session.add(base_study)
    session.commit()

    session.add(
        BaseStudyMetadataOutbox(
            base_study_id=base_study.id,
            reason="test-year-zero-missing",
        )
    )
    session.commit()

    fetch_counts = {"semantic": 0, "pubmed": 0}

    monkeypatch.setattr(
        metadata_service, "lookup_ids_semantic_scholar", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service, "lookup_ids_pubmed", lambda *_args, **_kwargs: {}
    )
    monkeypatch.setattr(
        metadata_service, "lookup_ids_openalex", lambda *_args, **_kwargs: {}
    )

    def _semantic_with_invalid_year(*_args, **_kwargs):
        fetch_counts["semantic"] += 1
        return {
            "year": 0,
            "name": "Provider Name",
            "description": "Provider Description",
            "publication": "Provider Journal",
            "authors": "Provider Author",
        }

    def _pubmed_with_valid_year(*_args, **_kwargs):
        fetch_counts["pubmed"] += 1
        return {"year": 2023}

    monkeypatch.setattr(
        metadata_service, "fetch_metadata_semantic_scholar", _semantic_with_invalid_year
    )
    monkeypatch.setattr(
        metadata_service, "fetch_metadata_pubmed", _pubmed_with_valid_year
    )

    processed = process_base_study_metadata_outbox_batch(batch_size=10)
    assert processed == 1

    session.refresh(base_study)
    assert base_study.year == 2023
    assert fetch_counts["semantic"] == 1
    assert fetch_counts["pubmed"] == 1


def test_metadata_worker_uses_new_provider_config_keys(session, app, monkeypatch):
    from neurostore.services import base_study_metadata_enrichment as metadata_service

    base_study = BaseStudy(
        name=None,
        pmid="990001",
        level="group",
    )
    session.add(base_study)
    session.commit()

    captured_kwargs = {}

    def _fake_lookup_semantic(_identifiers, api_key=None):
        captured_kwargs["semantic_lookup_api_key"] = api_key
        return {}

    def _fake_lookup_pubmed(_identifiers, email=None, api_key=None, tool=None):
        captured_kwargs["pubmed_lookup"] = {
            "email": email,
            "api_key": api_key,
            "tool": tool,
        }
        return {}

    def _fake_lookup_openalex(_identifiers, email=None):
        captured_kwargs["openalex_lookup_email"] = email
        return {}

    def _fake_fetch_semantic(_identifiers, api_key=None):
        captured_kwargs["semantic_fetch_api_key"] = api_key
        return {}

    def _fake_fetch_pubmed(_identifiers, email=None, api_key=None, tool=None):
        captured_kwargs["pubmed_fetch"] = {
            "email": email,
            "api_key": api_key,
            "tool": tool,
        }
        return {}

    monkeypatch.setattr(
        metadata_service, "lookup_ids_semantic_scholar", _fake_lookup_semantic
    )
    monkeypatch.setattr(metadata_service, "lookup_ids_pubmed", _fake_lookup_pubmed)
    monkeypatch.setattr(metadata_service, "lookup_ids_openalex", _fake_lookup_openalex)
    monkeypatch.setattr(
        metadata_service, "fetch_metadata_semantic_scholar", _fake_fetch_semantic
    )
    monkeypatch.setattr(metadata_service, "fetch_metadata_pubmed", _fake_fetch_pubmed)

    original_values = {
        "SEMANTIC_SCHOLAR_API_KEY": app.config.get("SEMANTIC_SCHOLAR_API_KEY"),
        "PUBMED_TOOL_API_KEY": app.config.get("PUBMED_TOOL_API_KEY"),
        "EMAIL": app.config.get("EMAIL"),
        "PUBMED_TOOL": app.config.get("PUBMED_TOOL"),
        "PUBMED_API_KEY": app.config.get("PUBMED_API_KEY"),
        "PUBMED_EMAIL": app.config.get("PUBMED_EMAIL"),
        "OPENALEX_EMAIL": app.config.get("OPENALEX_EMAIL"),
    }
    app.config["SEMANTIC_SCHOLAR_API_KEY"] = "semantic-new-key"
    app.config["PUBMED_TOOL_API_KEY"] = "pubmed-new-key"
    app.config["EMAIL"] = "new@example.org"
    app.config["PUBMED_TOOL"] = "neurostore-test-tool"
    app.config["PUBMED_API_KEY"] = "pubmed-old-key"
    app.config["PUBMED_EMAIL"] = "old-pubmed@example.org"
    app.config["OPENALEX_EMAIL"] = "old-openalex@example.org"
    try:
        metadata_service.enrich_base_study_metadata(base_study.id)
    finally:
        for key, value in original_values.items():
            app.config[key] = value

    assert captured_kwargs["semantic_lookup_api_key"] == "semantic-new-key"
    assert captured_kwargs["semantic_fetch_api_key"] == "semantic-new-key"
    assert captured_kwargs["pubmed_lookup"] == {
        "email": "new@example.org",
        "api_key": "pubmed-new-key",
        "tool": "neurostore-test-tool",
    }
    assert captured_kwargs["pubmed_fetch"] == {
        "email": "new@example.org",
        "api_key": "pubmed-new-key",
        "tool": "neurostore-test-tool",
    }
    assert captured_kwargs["openalex_lookup_email"] == "new@example.org"


def test_enqueue_metadata_updates_treats_blank_values_as_missing(session):
    base_study = BaseStudy(
        name="Metadata Missing",
        pmid="970001",
        doi="10.9700/test",
        publication="   ",
        level="group",
    )
    session.add(base_study)
    session.commit()

    enqueued = enqueue_base_study_metadata_updates([base_study.id], reason="test-blank")
    assert enqueued == 1
    assert (
        BaseStudyMetadataOutbox.query.filter_by(
            base_study_id=base_study.id
        ).one_or_none()
        is not None
    )


def test_enqueue_metadata_updates_treats_year_zero_as_missing(session):
    base_study = BaseStudy(
        name="Year Zero Metadata",
        pmid="970002",
        doi="10.9700/year-zero",
        year=0,
        level="group",
    )
    session.add(base_study)
    session.commit()

    enqueued = enqueue_base_study_metadata_updates(
        [base_study.id], reason="test-year-zero"
    )
    assert enqueued == 1
    assert (
        BaseStudyMetadataOutbox.query.filter_by(
            base_study_id=base_study.id
        ).one_or_none()
        is not None
    )


def test_enqueue_metadata_updates_skips_blank_identifier_only_rows(session):
    base_study = BaseStudy(
        name=None,
        pmid="   ",
        doi="",
        pmcid="",
        level="group",
    )
    session.add(base_study)
    session.commit()

    enqueued = enqueue_base_study_metadata_updates([base_study.id], reason="test-skip")
    assert enqueued == 0
    assert (
        BaseStudyMetadataOutbox.query.filter_by(
            base_study_id=base_study.id
        ).one_or_none()
        is None
    )


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


def test_is_active_filter_list(auth_client, session, ingest_neurosynth):
    """Test that inactive base studies are filtered out from list view"""
    from neurostore.core import cache

    # First get the list of all base studies
    resp = auth_client.get("/api/base-studies/")
    assert resp.status_code == 200
    data = resp.json()
    initial_count = len(data["results"])
    assert initial_count > 0, "Should have at least one base study"

    # Get a base study and mark it as inactive
    base_study = BaseStudy.query.first()
    assert base_study is not None
    inactive_id = base_study.id

    # Mark it as inactive
    base_study.is_active = False
    session.commit()

    # Clear all cache to ensure the next request sees the updated data
    cache.clear()

    # Try to list all base studies - should not include the inactive one
    resp = auth_client.get("/api/base-studies/")
    assert resp.status_code == 200
    data = resp.json()

    # Verify the inactive study is not in the results
    result_ids = [result["id"] for result in data["results"]]
    assert inactive_id not in result_ids
    # Should have one less study than before
    assert len(data["results"]) == initial_count - 1


def test_is_active_filter_get(auth_client, session, ingest_neurosynth):
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
        name="Old Study", doi="10.1234/old.study", pmid="11111111", is_active=False
    )
    study2 = BaseStudy(
        name="New Study", doi="10.1234/new.study", pmid="22222222", is_active=True
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


def test_is_active_not_exposed_in_api(auth_client, ingest_neurosynth):
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
