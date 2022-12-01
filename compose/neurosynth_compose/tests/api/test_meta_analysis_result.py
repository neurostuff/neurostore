from pathlib import Path

from ...models import MetaAnalysis, User

def test_meta_analysis_result(app, auth_client, user_data, meta_analysis_results, mock_pynv):
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
