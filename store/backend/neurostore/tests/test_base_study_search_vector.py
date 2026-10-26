"""Base study search ranks on title and abstract and also matches full text.

The test database is built by the migrations, so these tests check what a
migrated database does, not what the model declares.
"""

import pytest
import sqlalchemy as sa

from neurostore.models import BaseStudy
from neurostore.resources.utils import apply_search_predicate
from neurostore.tests.api.test_query_params import _list_endpoints

pytestmark = pytest.mark.anyio

TERM = "zyxomma"


@pytest.fixture
def ranked_corpus(session):
    """Hits placed in each field, the weaker fields hit more often.

    Ranked by how often the term occurs, the order would be full text, then
    abstract, then title: the reverse of the one asserted.
    """
    rows = {
        "title": BaseStudy(
            name="Zyxomma in the cortex",
            description="An unrelated abstract.",
            level="group",
        ),
        "abstract": BaseStudy(
            name="Plain heading",
            description="This abstract describes zyxomma, zyxomma and zyxomma.",
            level="group",
        ),
        "pubget_full_text": BaseStudy(
            name="Another heading",
            description="An unrelated abstract.",
            pubget_fulltext="Methods. " + "Zyxomma was measured. " * 50,
            level="group",
        ),
        "ace_full_text": BaseStudy(
            name="Third heading",
            description="An unrelated abstract.",
            ace_fulltext="Methods. Zyxomma was measured once.",
            level="group",
        ),
        "ace_behind_pubget": BaseStudy(
            name="Fourth heading",
            description="An unrelated abstract.",
            pubget_fulltext="Methods. Nothing relevant here.",
            ace_fulltext="Methods. Zyxomma was measured once.",
            level="group",
        ),
        "miss": BaseStudy(
            name="Nothing relevant",
            description="An unrelated abstract.",
            level="group",
        ),
    }
    session.add_all(rows.values())
    session.commit()
    return rows


def _ids_by_relevance(session):
    q, rank = apply_search_predicate(
        session.query(BaseStudy),
        TERM,
        {},
        ts_vector=BaseStudy._ts_vector,
        fulltext_vector=BaseStudy._fulltext_vector,
        pmid_match=None,
    )
    return [b.id for b in q.order_by(rank.desc(), BaseStudy.id.desc())]


def test_title_outranks_abstract_outranks_full_text(session, ranked_corpus):
    c = ranked_corpus
    ids = _ids_by_relevance(session)
    assert ids[:2] == [c["title"].id, c["abstract"].id]
    assert set(ids[2:]) == {c["pubget_full_text"].id, c["ace_full_text"].id}


def test_full_text_only_records_are_found(session, ranked_corpus):
    c = ranked_corpus
    assert set(_ids_by_relevance(session)) == {
        c["title"].id,
        c["abstract"].id,
        c["pubget_full_text"].id,
        c["ace_full_text"].id,
    }


async def test_search_matches_title_and_abstract_only_by_default(
    auth_client, ranked_corpus
):
    c = ranked_corpus
    resp = await auth_client.get(f"/api/base-studies/?search={TERM}")
    assert resp.status_code == 200, resp.text
    assert [r["id"] for r in resp.json()["results"]] == [
        c["title"].id,
        c["abstract"].id,
    ]
    assert resp.json()["metadata"]["total_count"] == 2


async def test_opting_in_matches_the_full_text_and_lists_those_last(
    auth_client, ranked_corpus
):
    c = ranked_corpus
    resp = await auth_client.get(f"/api/base-studies/?search={TERM}&search_full_text=true")
    assert resp.status_code == 200, resp.text
    ids = [r["id"] for r in resp.json()["results"]]
    assert ids[:2] == [c["title"].id, c["abstract"].id]
    assert set(ids[2:]) == {c["pubget_full_text"].id, c["ace_full_text"].id}
    assert resp.json()["metadata"]["total_count"] == 4


def test_the_default_predicate_never_matches_a_full_text_only_record(
    session, ranked_corpus
):
    c = ranked_corpus
    q, _ = apply_search_predicate(
        session.query(BaseStudy),
        TERM,
        {},
        ts_vector=BaseStudy._ts_vector,
        pmid_match=None,
    )
    assert {b.id for b in q} == {c["title"].id, c["abstract"].id}


def test_the_parameter_is_declared_exactly_where_the_view_has_a_full_text_vector():
    for path, advertised, view in _list_endpoints():
        if view is None:
            continue
        has_vector = hasattr(view._model, "_fulltext_vector")
        assert ("search_full_text" in advertised) == has_vector, path
        if view._multi_search:
            assert ("search_full_text" in view()._user_args) == has_vector, path


async def test_the_parameter_is_ignored_where_there_is_no_full_text_vector(
    auth_client, ingest_neurosynth, session
):
    plain = await auth_client.get("/api/studies/?search=a")
    flagged = await auth_client.get("/api/studies/?search=a&search_full_text=true")
    assert flagged.status_code == 200
    assert flagged.json() == plain.json()


def test_editing_a_record_updates_what_it_matches(session, ranked_corpus):
    c = ranked_corpus
    c["title"].name = "Renamed heading"
    c["pubget_full_text"].pubget_fulltext = "Methods. Nothing relevant here."
    c["miss"].pubget_fulltext = "Methods. Zyxomma was measured."
    session.commit()
    ids = _ids_by_relevance(session)
    assert c["title"].id not in ids
    assert c["pubget_full_text"].id not in ids
    assert c["miss"].id in ids
    assert ids[0] == c["abstract"].id


def test_both_vectors_have_a_gin_index(session):
    definitions = {
        row.indexname: row.indexdef
        for row in session.execute(
            sa.text(
                "SELECT indexname, indexdef FROM pg_indexes "
                "WHERE tablename = 'base_studies'"
            )
        )
    }
    assert "USING gin (__ts_vector__)" in definitions["ix_base_study___ts_vector__"]
    assert (
        "USING gin (__fulltext_vector__)"
        in definitions["ix_base_study___fulltext_vector__"]
    )


def test_planner_keeps_no_statistics_for_either_vector(session):
    """With statistics a common word is planned as a sequential scan that
    reads every full-text vector; see the migration."""
    targets = session.execute(
        sa.text(
            "SELECT attname, attstattarget FROM pg_attribute "
            "WHERE attrelid = 'base_studies'::regclass "
            "AND attname IN ('__ts_vector__', '__fulltext_vector__')"
        )
    ).all()
    assert {t.attname: t.attstattarget for t in targets} == {
        "__ts_vector__": 0,
        "__fulltext_vector__": 0,
    }
