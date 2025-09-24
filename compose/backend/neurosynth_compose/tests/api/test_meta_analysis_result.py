from neurosynth_compose.models import (
    MetaAnalysis,
    MetaAnalysisResult,
    NeurovaultCollection,
    NeurostoreAnalysis,
)
from sqlalchemy import select


def test_create_meta_analysis_result(session, db, app, auth_client, user_data):
    meta_analysis = db.session.execute(select(MetaAnalysis)).scalars().first()
    headers = {"Compose-Upload-Key": meta_analysis.run_key}
    data = {
        "studyset_snapshot": {"name": "my studyset"},
        "annotation_snapshot": {"name": "my_annotation"},
        "meta_analysis_id": meta_analysis.id,
    }
    auth_client.token = None
    # project should be a draft before running
    assert meta_analysis.project.draft is True
    resp = auth_client.post("/api/meta-analysis-results", data=data, headers=headers)
    # project should be not be a draft after running
    assert meta_analysis.project.draft is False
    assert resp.status_code == 200

    # view the meta_analysis
    meta_resp = auth_client.get(f"/api/meta-analyses/{meta_analysis.id}")

    assert meta_resp.status_code == 200


def test_create_meta_analysis_result_requires_upload_key(
    session, db, auth_client, user_data
):
    meta_analysis = db.session.execute(select(MetaAnalysis)).scalars().first()
    data = {
        "studyset_snapshot": {"name": "my studyset"},
        "annotation_snapshot": {"name": "my_annotation"},
        "meta_analysis_id": meta_analysis.id,
    }

    auth_client.token = None
    resp = auth_client.post("/api/meta-analysis-results", data=data)

    assert resp.status_code == 401


def test_create_meta_analysis_result_no_snapshots(session, db, auth_client, user_data):
    meta_analyses = db.session.execute(select(MetaAnalysis)).scalars().all()
    for meta_analysis in meta_analyses:
        meta_analysis.studyset.snapshot = None
        meta_analysis.annotation.snapshot = None
        headers = {"Compose-Upload-Key": meta_analysis.run_key}
        data = {
            "studyset_snapshot": {"name": "my studyset"},
            "annotation_snapshot": {"name": "my annotation"},
            "meta_analysis_id": meta_analysis.id,
        }
        auth_client.token = None
        resp = auth_client.post(
            "/api/meta-analysis-results", data=data, headers=headers
        )

        assert resp.status_code == 200


def test_put_meta_analysis_result_with_celery(
    session,
    app,
    db,
    auth_client,
    meta_analysis_cached_result_files,
    celery_app,
    mock_pynv,
    mock_ns,
):
    # Celery eager mode is set in the fixture for test isolation and reliability
    """
    Comprehensive test for MetaAnalysisResultsView.put that triggers actual Celery task execution.
    Ensures files are processed and tasks executed as in production.
    """
    # Recommend: Ensure CELERY_TASK_ALWAYS_EAGER is set for synchronous Celery execution
    app.config["CELERY_TASK_ALWAYS_EAGER"] = True

    meta_analysis_id = meta_analysis_cached_result_files["meta_analysis_id"]
    maps = meta_analysis_cached_result_files["maps"]
    tables = meta_analysis_cached_result_files["tables"]

    # Step 1: Create the meta analysis result (POST)
    from neurosynth_compose.models import MetaAnalysis

    meta_analysis = db.session.execute(
        select(MetaAnalysis).where(MetaAnalysis.id == meta_analysis_id)
    ).scalar_one_or_none()
    headers = {"Compose-Upload-Key": meta_analysis.run_key}
    post_data = {
        "studyset_snapshot": {"name": "my studyset"},
        "annotation_snapshot": {"name": "my_annotation"},
        "meta_analysis_id": meta_analysis_id,
    }
    resp_post = auth_client.post(
        "/api/meta-analysis-results", data=post_data, headers=headers
    )
    assert resp_post.status_code == 200
    meta_analysis_result_id = resp_post.json["id"]

    # Step 2: Parse tables into cluster_tables and diagnostic_tables
    cluster_tables = []
    diagnostic_tables = []
    for table_path in tables:
        fname = str(table_path).lower()
        # Simple heuristic: filename contains 'cluster' or 'diagnostic'
        if "clust" in fname:
            cluster_tables.append(table_path)
        elif "diag" in fname:
            diagnostic_tables.append(table_path)

    # Prepare data dict for upload (single or multiple files per key)
    def build_files_payload():
        payload = []
        handles = []

        def add_files(field, paths):
            for path in paths:
                fobj = open(path, "rb")
                payload.append((field, (path.name, fobj, "application/octet-stream")))
                handles.append(fobj)

        add_files("statistical_maps", maps)
        add_files("cluster_tables", cluster_tables)
        add_files("diagnostic_tables", diagnostic_tables)
        return payload, handles

    files_payload, file_handles = build_files_payload()

    try:
        # PUT request to update meta analysis result
        resp = auth_client.put(
            f"/api/meta-analysis-results/{meta_analysis_result_id}",
            data=files_payload,
            headers=headers,
            content_type="multipart/form-data",
            json_dump=False,
        )

        # Validate response
        assert resp.status_code == 200, resp.json
    finally:
        for fobj in file_handles:
            fobj.close()
    # Optionally, check database changes and Celery task effects
    updated_result = db.session.execute(
        select(MetaAnalysis).where(MetaAnalysis.id == meta_analysis_id)
    ).scalar_one_or_none()
    assert updated_result is not None

    # Assign meta_analysis_result before use
    meta_analysis_result = db.session.execute(
        select(MetaAnalysisResult).where(
            MetaAnalysisResult.id == meta_analysis_result_id
        )
    ).scalar_one()
    assert meta_analysis_result is not None, "MetaAnalysisResult object not found"

    # Inspect NeurovaultCollection and NeurovaultFile statuses
    nv_collection = db.session.execute(
        select(NeurovaultCollection).where(
            NeurovaultCollection.result_id == meta_analysis_result.id
        )
    ).scalar_one_or_none()
    assert nv_collection is not None, "NeurovaultCollection object not found"

    # Inspect NeurostoreAnalysis execution status
    neurostore_analysis = db.session.execute(
        select(NeurostoreAnalysis).where(
            NeurostoreAnalysis.meta_analysis_id == meta_analysis_id
        )
    ).scalar_one_or_none()
    assert neurostore_analysis is not None, "NeurostoreAnalysis object not found"
    assert (
        neurostore_analysis.status == "OK"
    ), f"NeurostoreAnalysis.status is '{neurostore_analysis.status}', expected 'OK'"
    # Further assertions can be added to validate Neurovault/Neurostore integration

    # PREP Files again
    files_payload, second_handles = build_files_payload()

    try:
        # RUN the put request again to see how it handles repeats
        resp2 = auth_client.put(
            f"/api/meta-analysis-results/{meta_analysis_result_id}",
            data=files_payload,
            headers=headers,
            content_type="multipart/form-data",
            json_dump=False,
        )

        assert resp2.status_code == 200, resp2.json
        assert neurostore_analysis.status == "OK"
    finally:
        for fobj in second_handles:
            fobj.close()


def test_put_meta_analysis_result_requires_upload_key(
    session, db, auth_client, user_data
):
    meta_analysis = db.session.execute(select(MetaAnalysis)).scalars().first()
    headers = {"Compose-Upload-Key": meta_analysis.run_key}
    post_data = {
        "studyset_snapshot": {"name": "my studyset"},
        "annotation_snapshot": {"name": "my_annotation"},
        "meta_analysis_id": meta_analysis.id,
    }

    auth_client.token = None
    create_resp = auth_client.post(
        "/api/meta-analysis-results", data=post_data, headers=headers
    )
    assert create_resp.status_code == 200
    result_id = create_resp.json["id"]

    # Attempt to update without providing the upload key should fail auth
    update_resp = auth_client.put(
        f"/api/meta-analysis-results/{result_id}",
        data={"meta_analysis_id": meta_analysis.id},
    )

    assert update_resp.status_code == 401
