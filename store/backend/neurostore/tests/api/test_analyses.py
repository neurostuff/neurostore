import pytest

pytestmark = pytest.mark.anyio

from neurostore.models import Analysis, Image, Point, Study, User
from neurostore.schemas import AnalysisSchema


async def test_get_nested_and_not_nested_analyses(async_auth_client, ingest_neurosynth, session):
    analysis_id = Analysis.query.first().id
    non_nested = await async_auth_client.get(f"/api/analyses/{analysis_id}?nested=false")
    nested = await async_auth_client.get(f"/api/analyses/{analysis_id}?nested=true")

    assert isinstance(non_nested.json()["points"][0], str)
    assert isinstance(nested.json()["points"][0], dict)


async def test_get_analyses(async_auth_client, ingest_neurosynth, session):
    # List of analyses
    resp = await async_auth_client.get("/api/analyses/")
    assert resp.status_code == 200
    analysis_list = resp.json()["results"]
    assert isinstance(analysis_list, list)

    assert len(analysis_list) == Analysis.query.count()

    # Check analysis keys
    analysis = analysis_list[0]
    keys = [
        "id",
        "conditions",
        "created_at",
        "images",
        "name",
        "points",
        "study",
        "weights",
        "table_id",
    ]
    for k in keys:
        assert k in analysis

    a_id = analysis["id"]

    # Query specify analysis ID
    resp = await async_auth_client.get(f"/api/analyses/{a_id}")
    resp_json = resp.json()
    assert resp.status_code == 200
    assert set(resp_json["points"]) == set(analysis["points"])
    assert set(resp_json["images"]) == set(analysis["images"])
    resp_json.pop("points")
    resp_json.pop("images")
    analysis.pop("points")
    analysis.pop("images")

    assert resp_json == analysis
    assert resp_json["id"] == a_id


async def test_get_analyses_filter_by_study(async_auth_client, session):
    first_study_resp = await async_auth_client.post(
        "/api/studies/",
        data={
            "name": "analysis-study-filter-first",
            "pmid": "910031",
            "doi": "10.1000/analysis-study-filter-first",
            "analyses": [{"name": "analysis-study-filter-first-analysis"}],
        },
    )
    second_study_resp = await async_auth_client.post(
        "/api/studies/",
        data={
            "name": "analysis-study-filter-second",
            "pmid": "910032",
            "doi": "10.1000/analysis-study-filter-second",
            "analyses": [{"name": "analysis-study-filter-second-analysis"}],
        },
    )

    assert first_study_resp.status_code == 200
    assert second_study_resp.status_code == 200

    first_study_id = first_study_resp.json()["id"]
    second_study_id = second_study_resp.json()["id"]
    first_analysis_id = first_study_resp.json()["analyses"][0]
    second_analysis_id = second_study_resp.json()["analyses"][0]

    filtered_resp = await async_auth_client.get(f"/api/analyses/?study={first_study_id}")
    second_filtered_resp = await async_auth_client.get(f"/api/analyses/?study={second_study_id}")

    assert filtered_resp.status_code == 200
    assert second_filtered_resp.status_code == 200

    filtered_analysis_ids = {
        analysis["id"] for analysis in filtered_resp.json()["results"]
    }
    second_filtered_analysis_ids = {
        analysis["id"] for analysis in second_filtered_resp.json()["results"]
    }

    assert first_analysis_id in filtered_analysis_ids
    assert second_analysis_id not in filtered_analysis_ids
    assert second_analysis_id in second_filtered_analysis_ids
    assert first_analysis_id not in second_filtered_analysis_ids


async def test_analysis_emits_all_media_flags(async_auth_client, session):
    create_study = await async_auth_client.post(
        "/api/studies/",
        data={
            "name": "analysis-media-flags",
            "pmid": "910021",
            "doi": "10.1000/analysis-media-flags",
            "analyses": [
                {
                    "name": "analysis-with-map-types",
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

    analysis_id = create_study.json()["analyses"][0]
    response = await async_auth_client.get(f"/api/analyses/{analysis_id}")
    assert response.status_code == 200
    payload = response.json()

    assert payload["has_coordinates"] is False
    assert payload["has_images"] is True
    assert payload["has_z_maps"] is True
    assert payload["has_t_maps"] is True
    assert payload["has_beta_and_variance_maps"] is True


async def test_post_analyses(async_auth_client, ingest_neurosynth, session):
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = async_auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.study.user = user
    session.add(analysis_db.study)
    session.commit()
    for k in ["user", "id", "created_at", "updated_at", "entities"]:
        analysis.pop(k, None)
    resp = await async_auth_client.post("/api/analyses/", data=analysis)

    assert resp.status_code == 200


async def test_delete_coordinate_analyses(async_auth_client, ingest_neurosynth, session):
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = async_auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.user = user
    session.add(analysis_db)
    session.commit()

    await async_auth_client.delete(f"/api/analyses/{analysis_db.id}")

    for point in analysis["points"]:
        assert Point.query.filter_by(id=point).first() is None


async def test_delete_image_analyses(async_auth_client, ingest_neurovault, session):
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = async_auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.user = user
    session.add(analysis_db)
    session.commit()

    await async_auth_client.delete(f"/api/analyses/{analysis_db.id}")

    for image in analysis["images"]:
        image_db = Image.query.filter_by(id=image).one()
        assert image_db.analysis_id is None
        assert image_db.study_id == analysis["study"]


async def test_update_points_analyses(async_auth_client, ingest_neurovault, session):
    analysis_db = Analysis.query.where(Analysis.analysis_conditions.any()).first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = async_auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.user = user
    session.add(analysis_db)
    session.commit()

    points = analysis["points"]

    payload = {"points": points[:-1]}
    # cache the get endpoints
    await async_auth_client.get(f"/api/analyses/{analysis_db.id}?nested=false")
    await async_auth_client.get(f"/api/analyses/{analysis_db.id}?nested=true")
    await async_auth_client.get(f"/api/analyses/{analysis_db.id}")

    update_points = await async_auth_client.put(f"/api/analyses/{analysis_db.id}", data=payload)

    assert update_points.status_code == 200
    assert payload["points"] == update_points.json()["points"]

    # see if cache updated
    nested_get = await async_auth_client.get(f"/api/analyses/{analysis_db.id}?nested=false")
    nonnested_get = await async_auth_client.get(f"/api/analyses/{analysis_db.id}?nested=true")
    get = await async_auth_client.get(f"/api/analyses/{analysis_db.id}")

    assert (
        set(p["id"] for p in nested_get.json()["points"])
        == set(p for p in nonnested_get.json()["points"])
        == set(p for p in get.json()["points"])
        == set(p for p in payload["points"])
    )


async def test_post_analysis_without_order(async_auth_client, ingest_neurosynth, session):
    # Get an existing analysis from the database
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)

    # Remove the 'order' field from the analysis
    analysis.pop("order", None)

    # Submit a POST request without the 'order' field
    resp = await async_auth_client.post("/api/analyses/", data=analysis)

    # Check if the response status code is 200 (OK)
    assert resp.status_code == 200

    # Check if the 'order' field is in the response
    assert "order" in resp.json()

    # Check if the 'order' field is not None
    assert resp.json()["order"] is not None


async def test_put_analysis_partial_does_not_reset_order(async_auth_client, session):
    id_ = async_auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    study = Study(
        name="partial analysis update",
        user=user,
        analyses=[Analysis(name="analysis", user=user, order=3)],
    )
    session.add(study)
    session.commit()

    analysis_id = study.analyses[0].id
    resp = await async_auth_client.put(f"/api/analyses/{analysis_id}", data={"name": "renamed"})

    assert resp.status_code == 200
    assert resp.json()["name"] == "renamed"
    assert resp.json()["order"] == 3


async def test_create_duplicate_analysis(async_auth_client, ingest_neurosynth, session):
    # Get an existing analysis from the database
    analysis_db = Analysis.query.first()
    analysis = AnalysisSchema().dump(analysis_db)
    id_ = async_auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    analysis_db.study.user = user
    for a in analysis_db.study.analyses:
        a.user = user
        session.add(a)
    session.add(analysis_db.study)
    session.commit()

    # Remove fields that are auto-generated
    for k in ["user", "id", "created_at", "updated_at", "entities"]:
        analysis.pop(k, None)

    # Create the first analysis
    resp = await async_auth_client.post("/api/analyses/", data=analysis)
    assert resp.status_code == 200

    # Attempt to create a duplicate analysis
    resp_duplicate = await async_auth_client.post("/api/analyses/", data=analysis)
    assert resp_duplicate.status_code == 200

    # Check if the duplicate analysis is the same as the original
    original_analysis = resp.json()
    duplicate_analysis = resp_duplicate.json()
    assert original_analysis["id"] == duplicate_analysis["id"]


def test_post_analyses_without_order_increments_within_study(auth_client, session):
    # A fresh study owned by the authenticated user, with no analyses yet.
    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    study = Study(name="order increment study", user=user)
    session.add(study)
    session.commit()

    payload = {"study": study.id, "name": "order increment analysis"}

    # POST two analyses to the same study, neither carrying an explicit order.
    resp1 = auth_client.post("/api/analyses/", data=dict(payload))
    resp2 = auth_client.post("/api/analyses/", data=dict(payload))

    assert resp1.status_code == 200
    assert resp2.status_code == 200

    # First analysis in the study -> order 1; second -> order 2 (not 1).
    assert resp1.json()["order"] == 1
    assert resp2.json()["order"] == 2
