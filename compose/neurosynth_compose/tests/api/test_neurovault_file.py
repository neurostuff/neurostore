from ...models import MetaAnalysis, User


def test_neurovault_file(auth_client, user_data, mock_pynv, meta_analysis_results):
    user = User.query.filter_by(name="user1").first()
    meta_analysis_id, results = meta_analysis_results[user.id].values()

    meta_analysis = MetaAnalysis.query.filter_by(id=meta_analysis_id).first()
    data = {"meta_analysis_id": meta_analysis.id}
    post_collection = auth_client.post("/api/neurovault-collections", data=data)
    z_stat = results.get_map("z_corr-FDR_method-indep")
    file_data = {
        "collection_id": post_collection.json["collection_id"],
        "file": str(z_stat.to_bytes().decode("latin1")),
    }
    post_file = auth_client.post("/api/neurovault-files", data=file_data)
    assert post_file.status_code == 200
