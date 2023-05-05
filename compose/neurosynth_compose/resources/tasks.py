import os
from pathlib import Path

from celery import Celery

from ..__init__ import create_app
from ..database import db
from ..models import NeurovaultFile, NeurovaultCollection, MetaAnalysis
from .neurostore import neurostore_session

app = create_app()
celery_app = Celery(app.import_name)
app.app_context().push()


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
            modality="Other",  # no good way to determine if all inputs were of the same modality
            # models.CharField(choices=[('T', 'T map'), ('Z', 'Z map'), ('F', 'F map'), ('X2', 'Chi squared map'), ('P', 'P map (given null hypothesis)'), ('IP', '1-P map ("inverted" probability)'), ('M', 'multivariate-beta map'), ('U', 'univariate-beta map'), ('R', 'ROI/mask'), ('Pa', 'parcellation'), ('A', 'anatomical'), ('V', 'variance'), ('Other', 'other')], help_text='Type of statistic that is the basis of the inference', max_length=200, verbose_name='Map type')),
            map_type=map_type,
            # https://github.com/NeuroVault/NeuroVault/blob/e3dc3c7767af12a3a7574eda64dcc9b749da8728/neurovault/apps/statmaps/models.py#LL1278C5-L1283C6
            analysis_level="M",
            is_valid=True,
            name=fname,
        )

        record.image_id = nv_file["id"]
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


@celery_app.task(name="neurostore.upload", bind=True)
def upload_neurostore(self, data, access_token, id, neurostore_study_id, meta_analysis_id):
    """
    0. create neurostore result
    1. create meta-analysis result
    2. attach to meta-analysis
    3. create new neurovault collection
    4. add files to neurovault collection
    """
    ns_ses = neurostore_session(access_token)

    meta_analysis = MetaAnalysis.query.filter_by(id=meta_analysis_id).one()

    analysis_data = {"name": meta_analysis.name}
    ns_ses.post(f"/api/studies/{neurostore_study_id}", data=analysis_data)

    # neurostore_study = ApiClient.studies_post(name=meta_analysis.name or meta_analysis.id)

    # meta_result = MetaAnalysisResult(
    #     meta_analysis_id=meta_analysis_id, neurostore_id=neurostore_study)
