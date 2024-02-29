from neurosynth_compose.models import Project
from neurosynth_compose.schemas import MetaAnalysisSchema


def test_get_all_projects(session, app, auth_client, user_data):
    projects = Project.query.all()

    project_ids = set(
        [
            m.id
            for m in projects
            if m.public or getattr(m.user, "external_id", None) == auth_client.username
        ]
    )

    returned_projects = auth_client.get("/api/projects")
    assert returned_projects.status_code == 200
    returned_ids = set([p["id"] for p in returned_projects.json["results"]])

    assert project_ids == returned_ids


def test_project_info(session, app, auth_client, user_data):
    proj = Project.query.first()

    info_resp = auth_client.get(f"/api/projects/{proj.id}?info=true")
    assert info_resp.status_code == 200

    info_fields = [
        f
        for f, v in MetaAnalysisSchema._declared_fields.items()
        if v.metadata.get("info_field")
    ]

    meta_analysis = info_resp.json["meta_analyses"][0]

    for f in info_fields:
        assert f in meta_analysis
