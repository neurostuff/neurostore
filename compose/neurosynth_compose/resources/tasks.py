import os
from pathlib import Path

from flask import current_app as app

from ..core import celery_app
from ..database import db
from ..models import NeurovaultFile, NeurovaultCollection, NeurostoreAnalysis


@celery_app.task(name="neurovault.upload", bind=True)
def file_upload_neurovault(self, fpath, id):
    from pynv import Client

    try:
        record = NeurovaultFile.query.filter_by(id=id).one()
    except:  # noqa: E722
        db.session.rollback()
        record = NeurovaultFile.query.filter_by(id=id).one()

    # record = NeurovaultFile.query.filter_by(id=id).one()
    api = Client(access_token=app.config["NEUROVAULT_ACCESS_TOKEN"])
    fname = Path(fpath).name

    map_type = "Other"

    if fname.startswith("z"):
        map_type = "Z"
    elif fname.startswith("p"):
        map_type = "P"
    elif fname.startswith("stat"):
        map_type = "U"

    try:
        nv_file = api.add_image(
            record.collection_id,
            fpath,
            # https://github.com/NeuroVault/NeuroVault/blob/e3dc3c7767af12a3a7574eda64dcc9b749da8728/neurovault/apps/statmaps/models.py#LL1409C5-L1421C6
            modality="Other",  # no good way to determine if all inputs were the same modality
            # models.CharField(choices=
            # [
            # ('T', 'T map'),
            # ('Z', 'Z map'),
            # ('F', 'F map'),
            # ('X2', 'Chi squared map'),
            # ('P', 'P map (given null hypothesis)'),
            # ('IP', '1-P map ("inverted" probability)'),
            # ('M', 'multivariate-beta map'),
            # ('U', 'univariate-beta map'),
            # ('R', 'ROI/mask'),
            # ('Pa', 'parcellation'),
            # ('A', 'anatomical'),
            # ('V', 'variance'),
            # ('Other', 'other')]
            map_type=map_type,
            # https://github.com/NeuroVault/NeuroVault/blob/e3dc3c7767af12a3a7574eda64dcc9b749da8728/neurovault/apps/statmaps/models.py#LL1278C5-L1283C6
            analysis_level="M",
            is_valid=True,
            name=fname,
        )
        record.value_type = map_type
        record.image_id = nv_file["id"]
        record.url = nv_file["url"]
        record.filename = nv_file["file"]
        record.space = nv_file["target_template_image"]
        record.status = "OK"

        # remove file
        os.remove(fpath)

    except Exception as exception:  # noqa: E722
        record.traceback = str(exception)
        record.status = "FAILED"

    try:
        db.session.add(record)
    except:  # noqa: E722
        db.session.rollback()
        raise
    else:
        db.session.commit()


@celery_app.task(name="neurostore.analysis_upload", bind=True)
def create_or_update_neurostore_analysis(
    self, ns_analysis_id, cluster_table, nv_collection_id, access_token
):
    from auth0.v3.authentication.get_token import GetToken
    import pandas as pd
    from .neurostore import neurostore_session
    ns_analysis = NeurostoreAnalysis.query.filter_by(id=ns_analysis_id).one()
    nv_collection = NeurovaultCollection.query.filter_by(id=nv_collection_id).one()

    # use the client to authenticate if user credentials were not used
    if not access_token:
        domain = app.config["AUTH0_BASE_URL"].lstrip("https://")
        g_token = GetToken(domain)
        token_resp = g_token.client_credentials(
            client_id=app.config["AUTH0_CLIENT_ID"],
            client_secret=app.config["AUTH0_CLIENT_SECRET"],
            audience=app.config["AUTH0_API_AUDIENCE"],
        )
        access_token = " ".join([token_resp["token_type"], token_resp["access_token"]])

    ns_ses = neurostore_session(access_token)

    # get the study(project) the (meta)analysis is associated with
    analysis_data = {
        "name": ns_analysis.meta_analysis.name or "Untitled",
        "study": ns_analysis.neurostore_study_id,
    }

    # parse the cluster table to get coordinates
    points = []
    if cluster_table:
        cluster_df = pd.read_csv(cluster_table, sep="\t")
        point_idx = 0
        for _, row in cluster_df.iterrows():
            point = {
                "coordinates": [row.X, row.Y, row.Z],
                "kind": "center of mass",  # make this dynamic
                "space": "MNI",  # make this dynamic
                "values": [
                    {
                        "kind": "Z",
                        "value": row["Peak Stat"],
                    }
                ],
                "order": point_idx
            }
            if not pd.isna(row["Cluster Size (mm3)"]):
                point["subpeak"] = True
                point["cluster_size"] = row["Cluster Size (mm3)"]
            else:
                point["subpeak"] = False
            points.append(point)
            point_idx += 1
    # reference the uploaded images on neurovault to associate images
    images = []
    for nv_file in nv_collection.files:
        image = {
            "url": nv_file.url,
            "filename": nv_file.filename,
            "space": nv_file.space,
            "value_type": nv_file.value_type,
        }
        images.append(image)

    if points:
        analysis_data["points"] = points
    if images:
        analysis_data["images"] = images

    try:
        # if the analysis already exists, update it
        if ns_analysis.neurostore_id:
            ns_analysis_res = ns_ses.put(
                f"/api/analyses/{ns_analysis.neurostore_id}", json=analysis_data
            )
        else:
            # create a new analysis
            ns_analysis_res = ns_ses.post("/api/analyses/", json=analysis_data)

        if ns_analysis_res.status_code != 200:
            ns_analysis.status = "FAILED"
            ns_analysis.traceback = ns_analysis_res.text
        else:
            ns_analysis.neurostore_id = ns_analysis_res.json()["id"]
            ns_analysis.status = "OK"
    except Exception as exception:  # noqa: E722
        ns_analysis.traceback = str(exception)
        ns_analysis.status = "FAILED"

    db.session.add(ns_analysis)
    db.session.commit()
