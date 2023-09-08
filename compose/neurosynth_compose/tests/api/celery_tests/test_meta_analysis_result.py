from ...conftest import celery_test
from ....models import (
    Project,
    MetaAnalysis,
    NeurovaultFile,
    NeurovaultCollection,
    NeurostoreStudy,
    NeurostoreAnalysis,
)
from ....resources.tasks import (
    file_upload_neurovault,
    create_or_update_neurostore_analysis,
)
from ....resources.analysis import (
    create_or_update_neurostore_study,
)


@celery_test
def test_file_upload_neurovault(session, app, db, mock_pynv):
    import os
    from pathlib import Path
    import shutil
    import tempfile
    from nibabel.testing import data_path

    nifti_file = os.path.join(data_path, "example_nifti2.nii.gz")
    nv_collection = NeurovaultCollection(collection_id=12345)
    nv_file = NeurovaultFile(neurovault_collection=nv_collection)
    db.session.add_all([nv_file, nv_collection])
    db.session.commit()

    with tempfile.TemporaryDirectory() as tmpdirname:
        tst_file = Path(tmpdirname) / "test.nii.gz"
        shutil.copyfile(nifti_file, tst_file)
        file_upload_neurovault(str(tst_file), nv_file.id)


@celery_test
def test_create_or_update_neurostore_analysis(
    session, auth_client, app, db, mock_pynv, meta_analysis_cached_result_files
):
    cluster_tables = [
        f for f in meta_analysis_cached_result_files["tables"] if "clust.tsv" in f.name
    ]
    project = Project(name="test project")
    meta_analysis = MetaAnalysis(name="test meta_analysis")
    project.meta_analyses.append(meta_analysis)
    ns_study = NeurostoreStudy(project=project)
    with app.test_request_context():
        create_or_update_neurostore_study(ns_study)

    ns_analysis = NeurostoreAnalysis(
        meta_analysis=meta_analysis,
        neurostore_study=ns_study,
    )
    cluster_table = cluster_tables[0]
    nv_collection = NeurovaultCollection(collection_id=12345)
    nv_file = NeurovaultFile(
        image_id=12345,
        filename="https://path/to/file",
        url="https://neurovault.org/images/this",
        space="GenericMNI",
        value_type="Z",
    )
    nv_collection.files.append(nv_file)
    db.session.add_all(
        [
            nv_file,
            nv_collection,
            ns_analysis,
            ns_study,
            meta_analysis,
            project,
        ]
    )
    db.session.commit()
    create_or_update_neurostore_analysis(
        ns_analysis.id, cluster_table, nv_collection.id, access_token=None
    )


@celery_test
def test_result_upload(
    session, auth_client, app, db, meta_analysis_cached_result_files
):
    data = {}
    data["statistical_maps"] = [
        (open(m, "rb"), m.name) for m in meta_analysis_cached_result_files["maps"]
    ]
    data["cluster_tables"] = [
        (open(f, "rb"), f.name)
        for f in meta_analysis_cached_result_files["tables"]
        if "clust.tsv" in f.name
    ]
    data["diagnostic_tables"] = [
        (open(f, "rb"), f.name)
        for f in meta_analysis_cached_result_files["tables"]
        if "clust.tsv" not in f.name
    ]
    data["method_description"] = meta_analysis_cached_result_files["method_description"]

    meta_analysis = MetaAnalysis.query.filter_by(
        id=meta_analysis_cached_result_files["meta_analysis_id"]
    ).one()
    ns_study = NeurostoreStudy(project=meta_analysis.project)
    with app.test_request_context():
        create_or_update_neurostore_study(ns_study)
    # use run_key instead of Bearer token
    auth_client.token = None
    run_key = (
        MetaAnalysis.query.filter_by(
            id=meta_analysis_cached_result_files["meta_analysis_id"]
        )
        .one()
        .run_key
    )

    headers = {"Compose-Upload-Key": f"{run_key}"}

    # test with only images upload
    reduced_data = {
        k: v for k, v in data.items() if k in ["statistical_maps", "method_description"]
    }
    rresp = auth_client.post(
        "/api/meta-analysis-results",
        data={
            "meta_analysis_id": meta_analysis_cached_result_files["meta_analysis_id"]
        },
        headers=headers,
    )
    rresult_id = rresp.json["id"]
    rupload_result = auth_client.put(
        f"/api/meta-analysis-results/{rresult_id}",
        data=reduced_data,
        json_dump=False,
        content_type="multipart/form-data",
        headers=headers,
    )

    assert rupload_result.status_code == 200

    # re-open the statistical maps
    data["statistical_maps"] = [
        (open(m, "rb"), m.name) for m in meta_analysis_cached_result_files["maps"]
    ]
    # with pre-existing snapshots
    code = None
    i = 0
    while code != 200:
        resp = auth_client.post(
            "/api/meta-analysis-results",
            data={
                "meta_analysis_id": meta_analysis_cached_result_files[
                    "meta_analysis_id"
                ]
            },
            headers=headers,
        )
        code = resp.status_code
        if i >= 5:
            break
        i += 1

    result_id = resp.json["id"]
    upload_result = auth_client.put(
        f"/api/meta-analysis-results/{result_id}",
        data=data,
        json_dump=False,
        content_type="multipart/form-data",
        headers=headers,
    )

    assert upload_result.status_code == 200
