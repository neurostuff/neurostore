"""Base study search on its BM25 index (ParadeDB's pg_search).

The test database is built by the migrations, so these tests check what a
migrated database does, not what the model declares.
"""

from urllib.parse import urlencode

import pytest
import sqlalchemy as sa

from neurostore.database import db
from neurostore.models import BaseStudy, User
from neurostore.resources.utils import pubmed_to_tsquery
from neurostore.tests.api.test_query_params import _list_endpoints

pytestmark = pytest.mark.anyio

TERM = "zyxomma"
PHRASE = '"zyxomma quellbrook"'


async def _search(client, **params):
    resp = await client.get(f"/api/base-studies/?{urlencode(params)}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return [r["id"] for r in body["results"]], body["metadata"]["total_count"]


@pytest.fixture
def ranked_corpus(session):
    """The term and the phrase once in a title, twice in an abstract and three
    times in a paper's text, among records of the same field lengths without
    them, so only the field boosts put the title first and the text last."""

    def filler(i, name=None, description=None, text=None):
        return BaseStudy(
            name=name or f"Plain heading number {i}",
            description=description
            or f"An abstract that reports a plain finding number {i} in detail.",
            pubget_fulltext=text
            or f"Methods. We measured a plain quantity number {i} with care. " * 2,
            level="group",
        )

    rows = {f"filler{i}": filler(i) for i in range(20)}
    rows["title"] = filler(20, name="Zyxomma quellbrook number 20")
    rows["abstract"] = filler(
        21,
        description="Zyxomma quellbrook and zyxomma quellbrook in a plain finding 21.",
    )
    rows["full_text"] = filler(
        22,
        text="Methods. Zyxomma quellbrook was measured. " * 3
        + "We measured with care number 22.",
    )
    session.add_all(rows.values())
    session.commit()
    return rows


def _ids(corpus, *keys):
    return [corpus[k].id for k in keys]


@pytest.mark.parametrize("query", [TERM, PHRASE])
async def test_title_outranks_abstract_outranks_full_text(
    auth_client, ranked_corpus, query
):
    ids, total = await _search(auth_client, search=query, search_full_text="true")
    assert ids == _ids(ranked_corpus, "title", "abstract", "full_text")
    assert total == 3


@pytest.mark.parametrize("query", [TERM, PHRASE])
async def test_search_matches_title_and_abstract_only_by_default(
    auth_client, ranked_corpus, query
):
    ids, total = await _search(auth_client, search=query)
    assert ids == _ids(ranked_corpus, "title", "abstract")
    assert total == 2


async def test_a_phrase_needs_its_words_in_order(auth_client, session):
    in_order = BaseStudy(name="Zyxomma quellbrook in cortex", level="group")
    apart = BaseStudy(name="Quellbrook, then zyxomma", level="group")
    session.add_all([in_order, apart])
    session.commit()
    phrase, _ = await _search(auth_client, search=PHRASE)
    words, _ = await _search(auth_client, search=PHRASE.strip('"'))
    assert phrase == [in_order.id]
    assert set(words) == {in_order.id, apart.id}


async def test_full_text_is_either_text_of_the_paper(auth_client, session):
    pubget = BaseStudy(name="One", pubget_fulltext="Zyxomma here.", level="group")
    ace = BaseStudy(name="Two", ace_fulltext="Zyxomma here.", level="group")
    ace_only_has_it = BaseStudy(
        name="Three",
        pubget_fulltext="Nothing relevant.",
        ace_fulltext="Zyxomma here.",
        level="group",
    )
    session.add_all([pubget, ace, ace_only_has_it])
    session.commit()
    assert await _search(auth_client, search=TERM) == ([], 0)
    ids, total = await _search(auth_client, search=TERM, search_full_text="true")
    assert set(ids) == {pubget.id, ace.id, ace_only_has_it.id}
    assert total == 3


# Titles and abstracts without the compounds the two tokenisers split
# differently (see test_a_compound_matches_as_a_phrase_of_its_parts).
PARITY_RECORDS = [
    ("Working memory in older adults", "Memories fade; the amygdala is spared."),
    ("Theory of mind and memory", "We tested working and long-term recall."),
    ("Amygdala responses to faces", "Fear conditioning in a working sample."),
    ("Reward learning", "Dopamine signals reward prediction errors in memory."),
    ("Memory working backwards", "No amygdala here, only planning."),
    ("Planned actions", "Plans, planning and planners in the frontal cortex."),
    (None, "An abstract on fear and reward without a title."),
]
PARITY_QUERIES = [
    "memory",
    "memories",
    "planning",
    "working memory",
    '"working memory"',
    '"theory of mind"',
    "memory amygdala",
    "memory OR reward",
    "memory -amygdala",
    "memory NOT amygdala",
    "(fear OR reward) AND -dopamine",
    "amygdala AND (working OR planning)",
    '-"working memory" memory',
    "fear OR reward memory",
    "memory / amygdala",
]


@pytest.fixture
def parity_corpus(session):
    rows = [
        BaseStudy(name=name, description=description, level="group")
        for name, description in PARITY_RECORDS
    ]
    session.add_all(rows)
    session.commit()
    return rows


@pytest.mark.parametrize("query", PARITY_QUERIES)
async def test_matches_what_the_title_and_abstract_tsvector_matches(
    auth_client, parity_corpus, session, query
):
    """The same records as Postgres's own text search over the title and
    abstract, which base-study search used before: words AND-ed, OR, NOT,
    quoted phrases, groups and English stemming."""
    tsvector_match = set(
        session.execute(
            sa.text(
                "SELECT id FROM base_studies WHERE to_tsvector('english', "
                "coalesce(name, '') || ' ' || coalesce(description, '')) "
                "@@ to_tsquery('english', :q)"
            ),
            {"q": pubmed_to_tsquery(query)},
        ).scalars()
    )
    ids, total = await _search(auth_client, search=query)
    assert tsvector_match
    assert set(ids) == tsvector_match
    assert total == len(tsvector_match)


async def test_a_stray_phrase_operator_joins_its_neighbours_as_and(
    auth_client, parity_corpus
):
    stray, _ = await _search(auth_client, search="memory <-> amygdala")
    both, _ = await _search(auth_client, search="memory amygdala")
    assert both
    assert stray == both


async def test_a_compound_matches_as_a_phrase_of_its_parts(auth_client, session):
    joined = BaseStudy(name="An fMRI-based study", level="group")
    spaced = BaseStudy(name="An fMRI based study", level="group")
    reversed_ = BaseStudy(name="Based on fMRI", level="group")
    slashed = BaseStudy(name="Hippocampus/amygdala volumes", level="group")
    session.add_all([joined, spaced, reversed_, slashed])
    session.commit()
    ids, _ = await _search(auth_client, search="fMRI-based")
    assert set(ids) == {joined.id, spaced.id}
    ids, _ = await _search(auth_client, search="amygdala")
    assert ids == [slashed.id]


async def test_a_search_of_no_words_matches_nothing(auth_client, parity_corpus):
    assert await _search(auth_client, search="...") == ([], 0)


@pytest.fixture
def tied_corpus(session):
    """25 records with the same text, so the same score."""
    rows = [
        BaseStudy(name="Tied zyxomma", description="Same text.", level="group")
        for _ in range(25)
    ]
    session.add_all(rows)
    session.commit()
    return [r.id for r in rows]


async def test_ties_page_in_a_stable_order_and_each_record_appears_once(
    auth_client, session, tied_corpus
):
    pages = []
    for page in (1, 2, 3):
        ids, total = await _search(auth_client, search=TERM, page=page, page_size=10)
        assert total == 25
        pages.append(ids)
    assert [len(p) for p in pages] == [10, 10, 5]
    by_hash = session.execute(
        sa.text(
            "SELECT id FROM base_studies ORDER BY hashtextextended(id, 0) DESC"
        )
    ).scalars()
    assert sum(pages, []) == list(by_hash)


async def test_a_search_page_is_one_index_scan(auth_client, session, tied_corpus):
    """The page comes straight out of the index in score order (its Top K
    scan), with the visibility filter applied inside it, and without parallel
    workers, which cost more to start than the scan."""
    statements = []

    def record(conn, cursor, statement, parameters, context, executemany):
        statements.append(cursor.mogrify(statement, parameters).decode())

    sa.event.listen(db.engine, "before_cursor_execute", record)
    try:
        await _search(auth_client, search=TERM, page=2, page_size=10)
    finally:
        sa.event.remove(db.engine, "before_cursor_execute", record)
    page = next(i for i, s in enumerate(statements) if "###" in s and "LIMIT" in s)
    assert any(
        "SET LOCAL max_parallel_workers_per_gather = 0" in s for s in statements[:page]
    )
    plan = "\n".join(session.execute(sa.text("EXPLAIN " + statements[page])).scalars())
    assert "TopKScanExecState" in plan
    assert "heap_filter" not in plan


async def test_filters_apply_with_search(auth_client, session):
    owner = User.query.filter_by(external_id=auth_client.username).one()
    other = User(name="other", external_id="other-user-id")
    session.add(other)
    rows = {
        "public": BaseStudy(name="Zyxomma public", level="group", year=2020),
        "inactive": BaseStudy(name="Zyxomma inactive", level="group", is_active=False),
        "own_private": BaseStudy(
            name="Zyxomma own", level="group", public=False, user=owner, year=2020
        ),
        "others_private": BaseStudy(
            name="Zyxomma other", level="group", public=False, user=other
        ),
        "meta": BaseStudy(name="Zyxomma meta-analysis", level="meta"),
        "old": BaseStudy(name="Zyxomma old", level="group", year=1990),
    }
    session.add_all(rows.values())
    session.commit()

    ids, total = await _search(auth_client, search=TERM)
    assert set(ids) == {rows[k].id for k in ("public", "own_private", "old")}
    assert total == 3
    ids, _ = await _search(auth_client, search=TERM, year_min=2000)
    assert set(ids) == {rows[k].id for k in ("public", "own_private")}
    ids, _ = await _search(auth_client, search=TERM, level="meta")
    assert ids == [rows["meta"].id]


async def test_an_edited_record_is_found_by_its_new_text(
    auth_client, session, ranked_corpus
):
    c = ranked_corpus
    c["title"].name = "Renamed heading about quixotry"
    c["full_text"].pubget_fulltext = "Methods. Nothing relevant here."
    c["filler0"].ace_fulltext = "Methods. Zyxomma was measured."
    session.commit()
    ids, _ = await _search(auth_client, search="quixotry")
    assert ids == [c["title"].id]
    ids, _ = await _search(auth_client, search=TERM, search_full_text="true")
    assert set(ids) == {c["abstract"].id, c["filler0"].id}


async def test_explicit_sort_keeps_its_order(auth_client, ranked_corpus):
    ids, total = await _search(
        auth_client, search=TERM, sort="name", desc="false", search_full_text="true"
    )
    expected = sorted(
        (ranked_corpus[k] for k in ("title", "abstract", "full_text")),
        key=lambda r: r.name.lower(),
    )
    assert ids == [r.id for r in expected]
    assert total == 3


def test_the_parameter_is_declared_only_where_full_text_is_searched():
    for path, advertised, view in _list_endpoints():
        if view is None:
            continue
        searches_full_text = path == "base-studies"
        assert ("search_full_text" in advertised) == searches_full_text, path
        assert ("search_full_text" in view()._user_args) == searches_full_text, path


async def test_the_parameter_is_ignored_where_full_text_is_not_searched(
    auth_client, ingest_neurosynth, session
):
    plain = await auth_client.get("/api/studies/?search=a")
    flagged = await auth_client.get("/api/studies/?search=a&search_full_text=true")
    assert flagged.status_code == 200
    assert flagged.json() == plain.json()


def test_the_index_covers_the_searched_and_filtered_fields(session):
    definition = session.execute(
        sa.text("SELECT indexdef FROM pg_indexes WHERE indexname = 'ix_base_study_search'")
    ).scalar_one()
    assert "USING paradedb" in definition
    for field in (
        "name",
        "description",
        "pubget_fulltext",
        "ace_fulltext",
        "is_active",
        "public",
        "user_id",
        "level",
        "year",
    ):
        assert field in definition
    columns = session.execute(
        sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'base_studies' AND column_name LIKE '%vector%'"
        )
    ).scalars()
    assert list(columns) == []


def test_the_index_and_its_table_are_kept_fast_to_search(session):
    """Vacuum always cleans the index, and the index has one segment and no
    mutable segment, whose buffered rows slow every search."""

    def options(name):
        return session.execute(
            sa.text("SELECT reloptions FROM pg_class WHERE relname = :name"),
            {"name": name},
        ).scalar_one()

    assert "vacuum_index_cleanup=on" in options("base_studies")
    assert {"target_segment_count=1", "mutable_segment_rows=0"} <= set(
        options("ix_base_study_search")
    )
