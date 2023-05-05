import pytest

from ...conftest import celery_test
from ....models import (
    MetaAnalysis,
    MetaAnalysisResult,
    NeurovaultFile,
    NeurovaultCollection,
    NeurostoreStudy,
    User,
)
from ....schemas import ResultUploadSchema
from ....resources.tasks import file_upload_neurovault, upload_neurostore
from ....resources.analysis import create_or_update_neurostore_study


@pytest.mark.skip(reason="neurovault not currently working.")
@celery_test
def test_meta_analysis_result(app, auth_client, user_data, meta_analysis_results):
    import time

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
    time.sleep(10)  # wait for celery to finish
    assert len(data["neurovault_collection"]["files"]) == len(
        post_result.json["neurovault_collection"]["files"]
    )


def test_file_upload_neurovault(app, db, mock_pynv):
    import os
    from pathlib import Path
    import shutil
    import tempfile
    from nibabel.testing import data_path
    nifti_file = os.path.join(data_path, 'example_nifti2.nii.gz')
    nv_collection = NeurovaultCollection(collection_id=12345)
    nv_file = NeurovaultFile(neurovault_collection=nv_collection)
    db.session.add_all([nv_file, nv_collection])
    db.session.commit()

    with tempfile.TemporaryDirectory() as tmpdirname:
        tst_file = Path(tmpdirname) / 'test.nii.gz'
        shutil.copyfile(nifti_file, tst_file)
        file_upload_neurovault(str(tst_file), nv_file.id)

# @celery_test
# def test_file_upload_neurovault(app, db, user_data, meta_analysis_results, mock_pynv):
#     user = User.query.filter_by(name="user1").first()
#     meta_analysis = MetaAnalysis.query.filter_by(user=user).first()
#     meta_analysis_result = MetaAnalysisResult(meta_analysis=meta_analysis)
#     coll_id = 12345
#     nv_coll = NeurovaultCollection(collection_id=coll_id, result=meta_analysis_result)
#     nv_file = NeurovaultFile(neurovault_collection=nv_coll)
#     db.session.add_all(
#         [
#             meta_analysis_result,
#             nv_coll,
#             nv_file,
#         ]
#     )
#     db.session.commit()

#     results = meta_analysis_results[user.id]["results"]
#     map_names = results.maps.keys()
#     data = {
#         "neurovault_collection": {
#             "files": [
#                 {"name": k, "file": results.get_map(k).to_bytes().decode("latin1")}
#                 for k in map_names
#             ]
#         }
#     }
#     submit_data = data["neurovault_collection"]["files"][0]
#     submit_data["collection_id"] = coll_id
#     file_upload_neurovault(submit_data, nv_file.id)


@celery_test
def test_upload_neurostore(app, db, user_data, meta_analysis_results):
    pass


def test_result_upload(auth_client, app, db, meta_analysis_cached_result_files):
    data = {}
    data["statistical_maps"] = [
        (open(m, 'rb'), m.name)
        for m in meta_analysis_cached_result_files['maps']
    ]
    data["cluster_tables"] = [
        (open(f, 'rb'), f.name)
        for f in meta_analysis_cached_result_files['tables']
        if 'clust.tsv' in f.name
    ]
    data["diagnostic_tables"] = [
        (open(f, 'rb'), f.name)
        for f in meta_analysis_cached_result_files['tables']
        if 'clust.tsv' not in f.name
    ]
    data["method_description"] = meta_analysis_cached_result_files["method_description"]

    meta_analysis = MetaAnalysis.query.filter_by(
        id=meta_analysis_cached_result_files["meta_analysis_id"]
    ).one()
    ns_study = NeurostoreStudy(project=meta_analysis.project)
    with app.test_request_context():
        create_or_update_neurostore_study(ns_study)
    resp = auth_client.post(
        "/api/meta-analysis-results",
        data={"meta_analysis_id": meta_analysis_cached_result_files["meta_analysis_id"]},
    )
    result_id = resp.json['id']
    auth_client.put(
        f"/api/meta-analysis-results/{result_id}",
        data=data,
        json_dump=False,
        content_type="multipart/form-data")

# headers={"Accept": "*/*", "Accept-Encoding": ["gzip, deflate, br"]},
# @celery_test
# def test_send_task_file_upload_neurovault(
#     app, db, session, user_data, meta_analysis_results, mock_pynv
# ):  # mock_pynv):
#     from ....resources.tasks import file_upload_neurovault, celery_app
#     user = User.query.filter_by(name="user1").first()
#     meta_analysis = MetaAnalysis.query.filter_by(user=user).first()
#     meta_analysis_result = MetaAnalysisResult(meta_analysis=meta_analysis)
#     coll_id = 12345
#     nv_coll = NeurovaultCollection(collection_id=coll_id, result=meta_analysis_result)
#     nv_file = NeurovaultFile(neurovault_collection=nv_coll)
#     session.add_all(
#         [
#             meta_analysis_result,
#             nv_coll,
#             nv_file,
#         ]
#     )
#     session.commit()
#     results = meta_analysis_results[user.id]["results"]
#     map_names = results.maps.keys()
#     data = {
#         "neurovault_collection": {
#             "files": [
#                 {"name": k, "file": results.get_map(k).to_bytes().decode("latin1")}
#                 for k in map_names
#             ]
#         }
#     }
#     submit_data = data["neurovault_collection"]["files"][0]
#     submit_data["collection_id"] = coll_id

#     task = celery_app.send_task("neurovault.upload", args=[submit_data, nv_file.id])
#     import time

#     time.sleep(5)
