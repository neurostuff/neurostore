"""The base study search vector is weighted and covers full text.

The test database is built by the migrations, so these tests check what a
migrated database does, not what the model declares.
"""

import pytest
import sqlalchemy as sa

from neurostore.models import BaseStudy
from neurostore.resources.utils import apply_search_predicate

pytestmark = pytest.mark.anyio

TERM = "zyxomma"


@pytest.fixture
def ranked_corpus(session):
    """Hits placed in each field, the weaker fields hit more often.

    Without weights the order would follow how often the term occurs
    (full text, then abstract, then title), the reverse of the one asserted.
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
        pmid_match=None,
    )
    return [b.id for b in q.order_by(rank.desc(), BaseStudy.id.desc())]


def test_title_outranks_abstract_outranks_full_text(session, ranked_corpus):
    c = ranked_corpus
    ids = _ids_by_relevance(session)
    assert ids[:3] == [c["title"].id, c["abstract"].id, c["pubget_full_text"].id]


def test_full_text_only_records_are_found(session, ranked_corpus):
    c = ranked_corpus
    assert set(_ids_by_relevance(session)) == {
        c["title"].id,
        c["abstract"].id,
        c["pubget_full_text"].id,
        c["ace_full_text"].id,
    }


async def test_search_endpoint_orders_by_weighted_relevance(auth_client, ranked_corpus):
    c = ranked_corpus
    resp = await auth_client.get(f"/api/base-studies/?search={TERM}")
    assert resp.status_code == 200, resp.text
    ids = [r["id"] for r in resp.json()["results"]]
    assert ids[:3] == [c["title"].id, c["abstract"].id, c["pubget_full_text"].id]
    assert c["ace_full_text"].id in ids
    assert c["ace_behind_pubget"].id not in ids


def test_migrated_vector_is_the_model_definition(session):
    """Postgres normalises both expressions, so equal text means equal definition."""
    column = BaseStudy.__table__.c["__ts_vector__"]
    model_expression = str(column.computed.sqltext)

    def generation_expression(table):
        return session.execute(
            sa.text(
                "SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attrdef d "
                "JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum "
                "WHERE a.attrelid = CAST(:table AS regclass) "
                "AND a.attname = '__ts_vector__'"
            ),
            {"table": table},
        ).scalar_one()

    session.execute(
        sa.text(
            "CREATE TEMP TABLE model_vector AS SELECT name, description, "
            "pubget_fulltext, ace_fulltext FROM base_studies WITH NO DATA"
        )
    )
    session.execute(
        sa.text(
            "ALTER TABLE model_vector ADD COLUMN __ts_vector__ tsvector "
            f"GENERATED ALWAYS AS ({model_expression}) STORED"
        )
    )
    assert generation_expression("base_studies") == generation_expression(
        "model_vector"
    )
    session.rollback()


def test_search_vector_has_a_gin_index(session):
    definition = session.execute(
        sa.text(
            "SELECT indexdef FROM pg_indexes WHERE tablename = 'base_studies' "
            "AND indexname = 'ix_base_study___ts_vector__'"
        )
    ).scalar_one()
    assert "USING gin (__ts_vector__)" in definition
