from ..core import celery_app, db
from ..models import NeurovaultFile, MetaAnalysis, NeurovaultCollection


@celery_app.task(name='neurovault.upload', bind=True)
def file_upload_neurovault(self, data, id):
    from pynv import Client

    from ..core import app
    meta = MetaAnalysis.query.first()
    if meta is None:
        raise ValueError("no meta!")
    coll = NeurovaultCollection.query.first()
    
    record = NeurovaultFile.query.filter_by(id=id).one()
    api = Client(access_token=app.config['NEUROVAULT_ACCESS_TOKEN'])

    try:
        nv_file = api.add_image(
            data['collection_id'], data['file'],
            modality="fMRI-BOLD", map_type=data.get("map_type", None),
            analysis_level="G", cognitive_paradigm_cogatlas='None',
            is_valid=True)
        
        data.pop('file') # remove file as it's been uploaded
        data['image_id'] = nv_file['id']
        data['status'] = "SUCCESS"
        
    except:
        data['status'] = "FAILURE"
    
    for k, v in data.items():
        setattr(record, k, v)
    
    db.session.add(record)
    db.session.commit()
