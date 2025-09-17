from neurosynth_compose.models import Project, MetaAnalysisResult, User
from neurosynth_compose.schemas import MetaAnalysisSchema
from sqlalchemy import select

from ..conftest import MockNeurostoreSession


def test_get_all_projects(session, app, auth_client, user_data):
    projects = session.execute(select(Project)).scalars().all()

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
    proj = session.execute(select(Project)).scalars().first()

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


def test_project_studyset_annotation_attributes(session, app, auth_client, user_data):
    """Test that project has studyset and annotation attributes"""
    proj = session.execute(select(Project)).scalars().first()

    resp = auth_client.get(f"/api/projects/{proj.id}")
    assert resp.status_code == 200

    project_data = resp.json

    # Check that studyset and annotation attributes are present
    assert "studyset" in project_data
    assert "annotation" in project_data

    # These should be string IDs (due to pluck metadata)
    assert isinstance(project_data["studyset"], str)
    assert isinstance(project_data["annotation"], str)


def test_delete_project(session, app, auth_client, user_data):
    # select a project owned by the authenticated client to ensure ownership checks pass
    project = (
        session.execute(
            select(Project)
            .join(Project.user)
            .where(User.external_id == auth_client.username)
        )
        .scalars()
        .first()
    )

    # add a meta-analysis result
    project.meta_analyses[0].results.append(MetaAnalysisResult())

    session.add(project)
    # persist into the test's transaction/savepoint only; avoid committing
    session.flush()

    bad_delete = auth_client.delete(f"/api/projects/{project.id}")

    assert bad_delete.status_code == 409

    project.meta_analyses[0].results = []
    session.add(project)
    # persist change to current savepoint without committing the outer transaction
    session.flush()

    good_delete = auth_client.delete(f"/api/projects/{project.id}")

    assert good_delete.status_code == 204


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


def test_clone_public_project_creates_new_project(
    session, auth_client, user_data, reset_ns_session, mock_ns
):
    source_project = (
        session.execute(
            select(Project)
            .join(Project.user)
            .where(User.external_id != auth_client.username)
            .where(Project.public == True)  # noqa: E712
        )
        .scalars()
        .first()
    )
    assert source_project is not None

    source_meta_ids = [ma.id for ma in source_project.meta_analyses]
    response = auth_client.post(f"/api/projects?source_id={source_project.id}", data={})

    assert response.status_code == 200
    payload = response.json

    assert payload["id"] != source_project.id
    assert payload["user"] == auth_client.username
    assert len(payload["meta_analyses"]) == len(source_meta_ids)
    assert set(payload["meta_analyses"]) != set(source_meta_ids)

    cloned_project = (
        session.execute(select(Project).where(Project.id == payload["id"]))
        .scalars()
        .one()
    )
    assert cloned_project.user.external_id == auth_client.username
    assert cloned_project.studyset_id and cloned_project.studyset_id != source_project.studyset_id
    assert cloned_project.annotation_id and cloned_project.annotation_id != source_project.annotation_id

    expected_auth = f"Bearer {auth_client.token}"
    auth_headers = {
        call["headers"].get("Authorization")
        for call in MockNeurostoreSession.call_log
        if call["method"] == "POST"
    }
    assert expected_auth in auth_headers


def test_clone_private_project_forbidden(
    session, auth_client, user_data, reset_ns_session, mock_ns
):
    private_project = (
        session.execute(
            select(Project)
            .join(Project.user)
            .where(User.external_id != auth_client.username)
            .where(Project.public == False)  # noqa: E712
        )
        .scalars()
        .first()
    )
    assert private_project is not None

    resp = auth_client.post(f"/api/projects?source_id={private_project.id}", data={})

    assert resp.status_code == 403


def test_clone_public_project_without_annotations(
    session, auth_client, user_data, reset_ns_session, mock_ns
):
    source_project = (
        session.execute(
            select(Project)
            .join(Project.user)
            .where(User.external_id != auth_client.username)
            .where(Project.public == True)  # noqa: E712
        )
        .scalars()
        .first()
    )
    assert source_project is not None
    assert source_project.annotation is not None

    response = auth_client.post(
        f"/api/projects?source_id={source_project.id}&copy_annotations=false",
        data={},
    )

    assert response.status_code == 200
    payload = response.json
    assert payload["annotation"] is None

    cloned_project = (
        session.execute(select(Project).where(Project.id == payload["id"]))
        .scalars()
        .one()
    )
    assert cloned_project.annotation_id is None

    # ensure query parameter propagated
    assert any(
        call["path"].endswith("copy_annotations=false")
        for call in MockNeurostoreSession.call_log
        if call["method"] == "POST" and call["path"].startswith("/api/studysets")
    )
