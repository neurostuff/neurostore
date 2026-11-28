"""The curation-tables revision moves provenance into the tables and back."""

import orjson
import pytest
import sqlalchemy as sa

from neurosynth_compose import service_migrations
from neurosynth_compose.curation import store as curation_store
from neurosynth_compose.models import Project
from neurosynth_compose.tests.curation_fixtures import (
    irregular_provenance,
    real_provenance,
)

BEFORE = "b8d2e6f0a4c1"
DOCUMENTS = {
    "irregular": irregular_provenance(),
    "real": real_provenance(),
    "empty": {},
    "nocuration": {"extractionMetadata": {"studysetId": None, "studyStatusList": []}},
}


@pytest.fixture
def at_previous_revision(db, session):
    session.remove()
    service_migrations.downgrade(BEFORE)
    yield db.engine
    db.session.remove()
    service_migrations.upgrade("heads")


def _stored_provenance(engine):
    with engine.connect() as conn:
        rows = conn.execute(sa.text("SELECT id, provenance::text FROM projects")).all()
    return {pid: orjson.loads(text) for pid, text in rows}


def test_upgrade_and_downgrade_keep_every_document(at_previous_revision, session):
    engine = at_previous_revision
    with engine.begin() as conn:
        for pid, doc in DOCUMENTS.items():
            conn.execute(
                sa.text("INSERT INTO projects (id, name, type, provenance) "
                        "VALUES (:id, :id, 'CBMA', CAST(:doc AS json))"),
                {"id": pid, "doc": orjson.dumps(doc).decode()},
            )

    service_migrations.upgrade("heads")
    for pid, doc in DOCUMENTS.items():
        assert curation_store.document(session.get(Project, pid)) == doc
    stubs = session.execute(sa.text("SELECT count(*) FROM curation_stubs")).scalar_one()
    assert stubs == sum(
        len(c["stubStudies"])
        for d in DOCUMENTS.values()
        for c in (d.get("curationMetadata") or {}).get("columns", [])
    )
    session.remove()

    service_migrations.downgrade(BEFORE)
    assert _stored_provenance(engine) == DOCUMENTS
