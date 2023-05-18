import os
from pathlib import Path

from flask import current_app as app
from celery import shared_task
from ..database import db
from ..models import NeurovaultFile


@shared_task(name="neurovault.upload", bind=True)
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
