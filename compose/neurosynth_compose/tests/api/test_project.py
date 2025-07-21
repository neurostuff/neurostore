from neurosynth_compose.models import Project, MetaAnalysisResult
from neurosynth_compose.schemas import MetaAnalysisSchema


def test_get_all_projects(session, app, auth_client, user_data):
    projects = Project.query.all()

    project_ids = set(
        [
            m.id
            for m in projects
            if (m.public and not m.draft)
            or getattr(m.user, "external_id", None) == auth_client.username
        ]
    )

    returned_projects = auth_client.get("/api/projects")
    assert returned_projects.status_code == 200
    returned_ids = set([p["id"] for p in returned_projects.json["results"]])

    assert project_ids == returned_ids


def test_project_info(session, app, auth_client, user_data):
    proj = Project.query.first()
    print(f"DEBUG: Project.query.first() = {proj}")

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


def test_delete_project(session, app, auth_client, user_data):
    project = Project.query.first()
    print(f"DEBUG: Project.query.first() = {project}")

    # add a meta-analysis result
    project.meta_analyses[0].results.append(MetaAnalysisResult())

    session.add(project)
    session.commit()

    bad_delete = auth_client.delete(f"/api/projects/{project.id}")

    assert bad_delete.status_code == 409

    project.meta_analyses[0].results = []
    session.add(project)
    session.commit()

    good_delete = auth_client.delete(f"/api/projects/{project.id}")

    assert good_delete.status_code == 200


def test_total_count(session, app, auth_client, user_data):
    response = auth_client.get("/api/projects")
    assert response.status_code == 200
    assert "total_count" in response.json["metadata"]


def test_filter_by_user_id(session, app, auth_client, user_data):
    # Add some projects to the database
    # ...

    user_id = auth_client.username
    response = auth_client.get(f"/api/projects?user_id={user_id}")
    assert response.status_code == 200
    for project in response.json["results"]:
        assert project["user"] == user_id


def test_search_capabilities(session, app, auth_client, user_data):
    # Add some projects to the database
    # ...

    search_term = "test"
    response = auth_client.get(f"/api/projects?search={search_term}")
    assert response.status_code == 200
