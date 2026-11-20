from neurosynth_compose.models.analysis import NeurostoreStudy, Project
from neurosynth_compose.models.auth import User
from neurosynth_compose.scripts.sync_neurostore_studies import sync_neurostore_studies
from neurosynth_compose.tests.conftest import MockNeurostoreSession


def _seed(session):
    user = User(external_id="owner-id", name="owner")
    private = Project(name="secret", public=False, user=user)
    public = Project(name="open", public=True, user=user)
    unsynced = Project(name="never uploaded", public=False, user=user)
    session.add_all(
        [
            user,
            private,
            public,
            unsynced,
            NeurostoreStudy(project=private, neurostore_id="ns-private"),
            NeurostoreStudy(project=public, neurostore_id="ns-public"),
            NeurostoreStudy(project=unsynced, neurostore_id=None),
        ]
    )
    session.commit()


def _study_puts():
    return {
        call["path"]: call
        for call in MockNeurostoreSession.call_log
        if call["method"] == "PUT" and call["path"].startswith("/api/studies/")
    }


def test_a_dry_run_counts_and_writes_nothing(app, session, reset_ns_session, mock_ns):
    _seed(session)
    summary = sync_neurostore_studies(settings=app.config, dry_run=True)
    assert summary.counts == {"private": 1, "public": 1}
    assert _study_puts() == {}


def test_each_study_takes_its_projects_privacy(app, session, reset_ns_session, mock_ns):
    _seed(session)
    summary = sync_neurostore_studies(settings=app.config, dry_run=False)

    puts = _study_puts()
    assert set(puts) == {"/api/studies/ns-private", "/api/studies/ns-public"}
    assert puts["/api/studies/ns-private"]["json"]["public"] is False
    assert puts["/api/studies/ns-private"]["json"]["name"] == "secret"
    assert puts["/api/studies/ns-public"]["json"]["public"] is True
    # One client-credentials token for the whole run, not one per study.
    assert {call["headers"]["Authorization"] for call in puts.values()} == {
        "Bearer mock-client-token"
    }
    assert summary.failed == []
