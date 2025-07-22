import os
from pathlib import Path
import shutil
import tempfile

import pandas as pd
import numpy as np
from nibabel.testing import data_path

from neurosynth_compose.models import (
    Project,
    MetaAnalysis,
    NeurovaultFile,
    NeurovaultCollection,
    NeurostoreStudy,
    NeurostoreAnalysis,
)
from neurosynth_compose.tasks.neurovault import file_upload_neurovault
from neurosynth_compose.tasks.neurostore import create_or_update_neurostore_analysis
from neurosynth_compose.resources.analysis import create_or_update_neurostore_study


def test_file_upload_neurovault(session, app, db, mock_pynv):

    nifti_file = os.path.join(data_path, "example_nifti2.nii.gz")
    nv_collection = NeurovaultCollection(collection_id=12345)
    nv_file = NeurovaultFile(
        neurovault_collection=nv_collection, filename=str(nifti_file)
    )
    db.session.add_all([nv_file, nv_collection])
    db.session.commit()

    with tempfile.TemporaryDirectory() as tmpdirname:
        tst_file = Path(tmpdirname) / "test.nii.gz"
        shutil.copyfile(nifti_file, tst_file)
        file_upload_neurovault(str(tst_file), nv_file.id)


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

    df = pd.read_csv(cluster_table, sep="\t")
    df = df.replace({np.nan: None})
    ns_analysis.cluster_table = df
    app.config["NEUROSTORE_URL"] = "http://dummy-neurostore"
    import unittest.mock as mock

    mock_response = mock.MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"id": "dummy-id"}
    with mock.patch("requests.post", return_value=mock_response):
        create_or_update_neurostore_analysis(ns_analysis.id)


def test_result_upload(
    session, auth_client, app, db, meta_analysis_cached_result_files
):
    data = {}
    # Open files and collect handles for later closing
    stat_map_files = [open(m, "rb") for m in meta_analysis_cached_result_files["maps"]]
    data["statistical_maps"] = [(f, f.name) for f in stat_map_files]
    cluster_table_files = [open(f, "rb") for f in meta_analysis_cached_result_files["tables"] if "clust.tsv" in f.name]
    data["cluster_tables"] = [(f, f.name) for f in cluster_table_files]
    diagnostic_table_files = [open(f, "rb") for f in meta_analysis_cached_result_files["tables"] if "clust.tsv" not in f.name]
    data["diagnostic_tables"] = [(f, f.name) for f in diagnostic_table_files]
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
    # Close all files opened for the first upload
    for f in stat_map_files + cluster_table_files + diagnostic_table_files:
        f.close()

    assert rupload_result.status_code == 200

    # re-open the statistical maps
    stat_map_files_2 = [open(m, "rb") for m in meta_analysis_cached_result_files["maps"]]
    data["statistical_maps"] = [(f, f.name) for f in stat_map_files_2]
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
    # Close all files opened for the second upload
    # Close all files opened for the second upload
    for f in stat_map_files_2:
        f.close()

    result_id = resp.json["id"]
    # Re-open files for the final upload
    stat_map_files_3 = [open(m, "rb") for m in meta_analysis_cached_result_files["maps"]]
    cluster_table_files_3 = [open(f, "rb") for f in meta_analysis_cached_result_files["tables"] if "clust.tsv" in f.name]
    diagnostic_table_files_3 = [open(f, "rb") for f in meta_analysis_cached_result_files["tables"] if "clust.tsv" not in f.name]
    data["statistical_maps"] = [(f, f.name) for f in stat_map_files_3]
    data["cluster_tables"] = [(f, f.name) for f in cluster_table_files_3]
    data["diagnostic_tables"] = [(f, f.name) for f in diagnostic_table_files_3]
    upload_result = auth_client.put(
        f"/api/meta-analysis-results/{result_id}",
        data=data,
        json_dump=False,
        content_type="multipart/form-data",
        headers=headers,
    )
    # Close all files opened for the final upload
    for f in stat_map_files_3 + cluster_table_files_3 + diagnostic_table_files_3:
        f.close()

    assert upload_result.status_code == 200
