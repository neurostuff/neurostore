from pathlib import Path
import shutil
from tempfile import mkdtemp

from nibabel import Nifti1Image

from ..core import celery_app
from ..database import init_db
from ..models import NeurovaultFile, MetaAnalysis, NeurovaultCollection


@celery_app.task(name='neurovault.upload', bind=True)
def file_upload_neurovault(self, data, id):
    from pynv import Client
    from flask import current_app as app

    db = init_db(app)
    record = NeurovaultFile.query.filter_by(id=id).one()
    api = Client(access_token=app.config['NEUROVAULT_ACCESS_TOKEN'])

    try:
        tmp_dir = Path(mkdtemp())
        filename = f"{data['collection_id']}_{data['name']}.nii"
        file_path = tmp_dir / filename
        nii = Nifti1Image.from_bytes(data['file'].encode('latin1'))
        nii.to_filename(file_path)

        nv_file = api.add_image(
            data['collection_id'], file_path.as_posix(),
            modality="fMRI-BOLD", map_type=data.get("map_type", 'Other'),
            analysis_level="G",
            is_valid=True, name=data['name'])
        
        data.pop('file') # remove file as it's been uploaded
        data['image_id'] = nv_file['id']
        data['status'] = "OK"

        # remove directory and file
        shutil.rmtree(tmp_dir)
        
    except:
        data['status'] = "FAILED"
    
    for k, v in data.items():
        setattr(record, k, v)
    
    db.session.add(record)
    db.session.commit()
