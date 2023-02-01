from pathlib import Path
from pynv import Client
import requests

from ....models import MetaAnalysis, MetaAnalysisResult, NeurovaultFile, NeurovaultCollection, User
from ....resources.tasks import file_upload_neurovault


def test_meta_analysis_result(app, auth_client, user_data, meta_analysis_results):
    user = User.query.filter_by(name="user1").first()
    meta_analysis = MetaAnalysis.query.filter_by(user=user).first()
    results = meta_analysis_results[user.id]['results']
    map_names = results.maps.keys()
    data = {
        "neurovault_collection":
        {
                "files":
                [
                        {'name': k, 'file': str(results.get_map(k).to_bytes().decode('latin1'))} for k in map_names
                ]
        }
    }
    data["meta_analysis_id"] = meta_analysis.id
    post_result = auth_client.post("/api/meta-analysis-results", data=data)
    assert post_result.status_code == 200

    api = Client(access_token=app.config['NEUROVAULT_ACCESS_TOKEN'])


def test_file_upload_neurovault(app, db, user_data, meta_analysis_results):# mock_pynv):
    user = User.query.filter_by(name="user1").first()
    meta_analysis = MetaAnalysis.query.filter_by(user=user).first()
    meta_analysis_result = MetaAnalysisResult(meta_analysis=meta_analysis)
    coll_id = 12345
    api = Client(access_token=app.config['NEUROVAULT_ACCESS_TOKEN'])
    collection = api.create_collection(
                meta_analysis.name,
                description=meta_analysis.description,
            )
    nv_coll = NeurovaultCollection(collection_id=collection['id'], result=meta_analysis_result)
    nv_file = NeurovaultFile(neurovault_collection=nv_coll)
    db.session.add_all([
        meta_analysis_result,
        nv_coll,
        nv_file,
    ])
    db.session.commit()

    results = meta_analysis_results[user.id]['results']
    map_names = results.maps.keys()
    data = {
        "neurovault_collection":
        {
                "files":
                [
                        {'name': k, 'file': results.get_map(k).to_bytes().decode('latin1')} for k in map_names
                ]
        }
    }
    submit_data = data['neurovault_collection']['files'][0]
    submit_data['collection_id'] = collection['id']
    file_upload_neurovault(submit_data, nv_file.id)
    # auth = requests.auth.HTTPBasicAuth(app.config['NEUROVAULT_ACCESS_TOKEN'])
    headers = {
        'Authorization': f"Bearer {app.config['NEUROVAULT_ACCESS_TOKEN']}",
        'referer': "https://neurovault.org",
        'content-type': 'application/json',
    }
    requests.delete(f"https://neurovault.org/collections/{collection['id']}", headers=headers)
