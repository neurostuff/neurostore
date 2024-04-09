from neurosynth_compose.models import MetaAnalysis


def test_create_meta_analysis_result(session, app, auth_client, user_data):
    meta_analysis = MetaAnalysis.query.first()
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


def test_create_meta_analysis_result_no_snapshots(
    session, app, db, auth_client, user_data
):
    meta_analysis = MetaAnalysis.query.first()
    meta_analysis.studyset.snapshot = None
    meta_analysis.annotation.snapshot = None
    headers = {"Compose-Upload-Key": meta_analysis.run_key}
    data = {
        "studyset_snapshot": {"name": "my studyset"},
        "annotation_snapshot": {"name": "my_annotation"},
        "meta_analysis_id": meta_analysis.id,
    }
    auth_client.token = None
    resp = auth_client.post("/api/meta-analysis-results", data=data, headers=headers)

    assert resp.status_code == 200
