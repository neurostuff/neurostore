from pathlib import Path

from ...models import MetaAnalysis, User


def test_neurovault_collection(app, auth_client, user_data, mock_pynv):
    user = User.query.filter_by(name="user1").first()
    meta_analysis = MetaAnalysis.query.filter_by(user=user).first()
    data = {"meta_analysis_id": meta_analysis.id}
    post_collection = auth_client.post("/api/neurovault-collections", data=data)
    assert post_collection.status_code == 200
    upload_dir = (
        Path(app.config["FILE_DIR"])
        / "uploads"
        / str(post_collection.json["collection_id"])
    )

    assert upload_dir.exists()
    # id_ = get_all.json["results"][0]['id']
    # get_one = auth_client.get(f"/api/annotations/{id_}")
    # assert get_one.status_code == 200
