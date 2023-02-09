import pytest

from ...conftest import celery_test
from ....models import (
    MetaAnalysis,
    MetaAnalysisResult,
    NeurovaultFile,
    NeurovaultCollection,
    User,
)
from ....resources.tasks import file_upload_neurovault, celery_app


@celery_test
def test_meta_analysis_result(app, auth_client, user_data, meta_analysis_results):
    user = User.query.filter_by(name="user1").first()
    meta_analysis = MetaAnalysis.query.filter_by(user=user).first()
    results = meta_analysis_results[user.id]["results"]
    map_names = results.maps.keys()
    data = {
        "neurovault_collection": {
            "files": [
                {"name": k, "file": str(results.get_map(k).to_bytes().decode("latin1"))}
                for k in map_names
            ]
        }
    }
    data["meta_analysis_id"] = meta_analysis.id
    post_result = auth_client.post("/api/meta-analysis-results", data=data)
    assert post_result.status_code == 200
    assert len(data["neurovault_collection"]["files"]) == len(
        post_result.json["neurovault_collection"]["files"]
    )


@celery_test
def test_file_upload_neurovault(app, db, user_data, meta_analysis_results, mock_pynv):
    user = User.query.filter_by(name="user1").first()
    meta_analysis = MetaAnalysis.query.filter_by(user=user).first()
    meta_analysis_result = MetaAnalysisResult(meta_analysis=meta_analysis)
    coll_id = 12345
    nv_coll = NeurovaultCollection(collection_id=coll_id, result=meta_analysis_result)
    nv_file = NeurovaultFile(neurovault_collection=nv_coll)
    db.session.add_all(
        [
            meta_analysis_result,
            nv_coll,
            nv_file,
        ]
    )
    db.session.commit()

    results = meta_analysis_results[user.id]["results"]
    map_names = results.maps.keys()
    data = {
        "neurovault_collection": {
            "files": [
                {"name": k, "file": results.get_map(k).to_bytes().decode("latin1")}
                for k in map_names
            ]
        }
    }
    submit_data = data["neurovault_collection"]["files"][0]
    submit_data["collection_id"] = coll_id
    file_upload_neurovault(submit_data, nv_file.id)


@celery_test
def test_send_task_file_upload_neurovault(
    app, db, session, user_data, meta_analysis_results, mock_pynv
):  # mock_pynv):
    user = User.query.filter_by(name="user1").first()
    meta_analysis = MetaAnalysis.query.filter_by(user=user).first()
    meta_analysis_result = MetaAnalysisResult(meta_analysis=meta_analysis)
    coll_id = 12345
    nv_coll = NeurovaultCollection(collection_id=coll_id, result=meta_analysis_result)
    nv_file = NeurovaultFile(neurovault_collection=nv_coll)
    session.add_all(
        [
            meta_analysis_result,
            nv_coll,
            nv_file,
        ]
    )
    session.commit()
    results = meta_analysis_results[user.id]["results"]
    map_names = results.maps.keys()
    data = {
        "neurovault_collection": {
            "files": [
                {"name": k, "file": results.get_map(k).to_bytes().decode("latin1")}
                for k in map_names
            ]
        }
    }
    submit_data = data["neurovault_collection"]["files"][0]
    submit_data["collection_id"] = coll_id

    task = celery_app.send_task("neurovault.upload", args=[submit_data, nv_file.id])
    import time

    time.sleep(5)
