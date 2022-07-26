from pathlib import Path
import re

from pynv import Client
from neurostore_sdk.api_client import ApiClient

from neurosynth_compose.models import MetaAnalysis, MetaAnalysisResult, NeurovaultCollection, NeurovaultFile


def upload_neurovault(flask_app, file_id, modality='fMRI-BOLD', n_subjects=None):
    """ Upload image file to NeuroVault
    Args:
        file_id (int): NeurovaultFileUpload object id
        modality: (str): Enumeration of 'fMRI-BOLD', 'VBM', 'DWI' (More to be added)
        n_subjects (int): Number of subjects in analysis
    """
    api = Client(access_token=flask_app.config['NEUROVAULT_ACCESS_TOKEN'])
    file_object = NeurovaultFile.query.filter_by(id=file_id).one()
    path = Path(file_object.path)

    basename = path.parts[-1]

    contrast_name = re.findall('contrast-(.*?)_', str(basename))[0]
    map_type = re.findall('stat-(.*?)_', str(basename))[0]

    try:
        api.add_image(
            file_object.collection.collection_id, str(path),
            name=contrast_name,
            modality=modality, map_type=map_type,
            analysis_level='M', cognitive_paradigm_cogatlas='None',
            number_of_subjects=n_subjects, is_valid=True)

        path.unlink()
    except Exception as e:
        update_record(
            file_object,
            exception=e,
            traceback='Error adding image to collection'
        )
        raise

    return update_record(
        file_object,
        status='OK'
        )


def upload_neurostore(flask_app, filenames, meta_analysis_id):
    """
    0. create neurostore result
    1. create meta-analysis result
    2. attach to meta-analysis
    3. create new neurovault collection
    4. add files to neurovault collection
    """
    meta_analysis = MetaAnalysis.query.filter_by(id=meta_analysis_id).one()
    
    neurostore_study = ApiClient.studies_post(name=meta_analysis.name or meta_analysis.id)

    meta_result = MetaAnalysisResult(meta_analysis_id=meta_analysis_id, neurostore_id=neurostore_study)

    
