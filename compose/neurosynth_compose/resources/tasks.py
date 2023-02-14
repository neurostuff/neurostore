from pathlib import Path
import shutil
from tempfile import mkdtemp

from celery import Celery
from nibabel import Nifti1Image


from ..__init__ import create_app
from ..database import db
from ..models import NeurovaultFile, MetaAnalysis

app = create_app()
celery_app = Celery(app.import_name)
app.app_context().push()


@celery_app.task(name="neurovault.upload", bind=True)
def file_upload_neurovault(self, data, id):
    from pynv import Client

    try:
        record = NeurovaultFile.query.filter_by(id=id).one()
    except:
        db.session.rollback()
        record = NeurovaultFile.query.filter_by(id=id).one()

    # record = NeurovaultFile.query.filter_by(id=id).one()
    api = Client(access_token=app.config["NEUROVAULT_ACCESS_TOKEN"])

    try:
        tmp_dir = Path(mkdtemp())
        filename = f"{data['collection_id']}_{data['name']}.nii"
        file_path = tmp_dir / filename
        nii = Nifti1Image.from_bytes(data["file"].encode("latin1"))
        nii.to_filename(file_path)

        nv_file = api.add_image(
            data["collection_id"],
            file_path.as_posix(),
            modality="fMRI-BOLD",
            map_type=data.get("map_type", "Other"),
            analysis_level="G",
            is_valid=True,
            name=data["name"],
        )

        data.pop("file")  # remove file as it's been uploaded
        data["image_id"] = nv_file["id"]
        data["status"] = "OK"

        # remove directory and file
        shutil.rmtree(tmp_dir)

    except Exception as exception:  # noqa: E722
        data['traceback'] = str(exception)
        data["status"] = "FAILED"

    for k, v in data.items():
        setattr(record, k, v)

    try:
        db.session.add(record)
    except:  # noqa: E722
        db.session.rollback()
        raise
    else:
        db.session.commit()


@celery_app.task(name="complex_db", bind=True)
def more_complex_db(self, meta_analysis_id):
    # rdb.set_trace()
    meta_analysis = MetaAnalysis.query.filter_by(id=meta_analysis_id).one()
    meta_analysis.description = "different"
    # meta_analysis_result = MetaAnalysisResult(meta_analysis=meta_analysis)
    # coll_id = 12345

    # nv_coll = NeurovaultCollection(collection_id=coll_id, result=meta_analysis_result)
    # nv_file = NeurovaultFile(neurovault_collection=nv_coll)
    db.session.add_all(
        [
            meta_analysis,
            # meta_analysis_result,
            # nv_coll,
            # nv_file,
        ]
    )
    db.session.commit()


# def upload_neurostore(flask_app, filenames, meta_analysis_id):
#     """
#     0. create neurostore result
#     1. create meta-analysis result
#     2. attach to meta-analysis
#     3. create new neurovault collection
#     4. add files to neurovault collection
#     """
#     meta_analysis = MetaAnalysis.query.filter_by(id=meta_analysis_id).one()

#     neurostore_study = ApiClient.studies_post(name=meta_analysis.name or meta_analysis.id)

#     meta_result = MetaAnalysisResult(
#         meta_analysis_id=meta_analysis_id, neurostore_id=neurostore_study)
