"""A project's Neurostore meta study is as private as the project, kept in sync."""

from neurosynth_compose.models import Project
from neurosynth_compose.tests.conftest import MockNeurostoreSession


def _study_writes():
    return [
        call
        for call in MockNeurostoreSession.call_log
        if call["method"] in ("POST", "PUT") and call["path"].startswith("/api/studies/")
    ]


def test_a_private_project_creates_a_private_study(
    auth_client, session, reset_ns_session, mock_ns
):
    resp = auth_client.post("/api/projects", data={"name": "secret", "public": False})
    assert resp.status_code == 200
    (write,) = _study_writes()
    assert write["method"] == "POST"
    assert write["json"]["public"] is False


def test_making_a_project_private_makes_its_study_private(
    auth_client, session, reset_ns_session, mock_ns
):
    project_id = auth_client.post("/api/projects", data={"name": "p"}).json["id"]
    neurostore_id = session.get(Project, project_id).neurostore_study.neurostore_id
    MockNeurostoreSession.reset()

    resp = auth_client.put(f"/api/projects/{project_id}", data={"public": False})
    assert resp.status_code == 200
    (write,) = _study_writes()
    assert write["method"] == "PUT"
    assert write["path"] == f"/api/studies/{neurostore_id}"
    assert write["json"]["public"] is False


def test_an_unrelated_edit_does_not_write_the_study(
    auth_client, session, reset_ns_session, mock_ns
):
    project_id = auth_client.post("/api/projects", data={"name": "p"}).json["id"]
    MockNeurostoreSession.reset()

    resp = auth_client.put(f"/api/projects/{project_id}", data={"provenance": {"x": 1}})
    assert resp.status_code == 200
    assert _study_writes() == []
