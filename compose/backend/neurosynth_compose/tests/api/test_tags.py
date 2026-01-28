from sqlalchemy import select

from neurosynth_compose.models import MetaAnalysis, Tag, User


def test_create_and_list_tags(session, auth_client, user_data):
    create = auth_client.post(
        "/api/tags", data={"name": "Hide", "official": True, "group": "visibility"}
    )
    assert create.status_code == 200

    tag_id = create.json["id"]

    duplicate = auth_client.post("/api/tags", data={"name": "hide"})
    assert duplicate.status_code == 200
    assert duplicate.json["id"] == tag_id

    listing = auth_client.get("/api/tags?search=hide")
    assert listing.status_code == 200
    returned_ids = {t["id"] for t in listing.json["results"]}
    assert tag_id in returned_ids

    name_listing = auth_client.get("/api/tags?name=hide")
    assert name_listing.status_code == 200
    name_ids = {t["id"] for t in name_listing.json["results"]}
    assert tag_id in name_ids

    group_listing = auth_client.get("/api/tags?group=visibility")
    assert group_listing.status_code == 200
    group_ids = {t["id"] for t in group_listing.json["results"]}
    assert tag_id in group_ids

    user_tag = auth_client.post(
        "/api/tags", data={"name": "personal", "group": "visibility"}
    )
    assert user_tag.status_code == 200

    official_listing = auth_client.get("/api/tags?official=true")
    assert official_listing.status_code == 200
    official_names = {t["name"].lower() for t in official_listing.json["results"]}
    assert "hide" in official_names
    assert "personal" not in official_names


def test_meta_analysis_tags_accept_id_and_name(session, auth_client, user_data):
    user = session.execute(
        select(User).where(User.external_id == auth_client.username)
    ).scalar_one_or_none()
    meta_analysis = (
        session.execute(select(MetaAnalysis).where(MetaAnalysis.user == user))
        .scalars()
        .first()
    )

    assert meta_analysis is not None

    tag = session.execute(
        select(Tag).where(Tag.user_id.is_(None)).limit(1)
    ).scalars().first()
    if tag is None:
        tag_resp = auth_client.post(
            "/api/tags", data={"name": "hide", "official": True}
        )
        assert tag_resp.status_code == 200
        tag_id = tag_resp.json["id"]
    else:
        tag_id = tag.id

    by_id = auth_client.put(
        f"/api/meta-analyses/{meta_analysis.id}", data={"tags": [tag_id]}
    )
    assert by_id.status_code == 200
    assert "hide" in {t.lower() for t in by_id.json.get("tags", [])}

    by_name = auth_client.put(
        f"/api/meta-analyses/{meta_analysis.id}", data={"tags": ["HIDE"]}
    )
    assert by_name.status_code == 200
    assert "hide" in {t.lower() for t in by_name.json.get("tags", [])}
