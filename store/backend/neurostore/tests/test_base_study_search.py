"""Base study search on its BM25 index (ParadeDB's pg_search).

The test database is built by the migrations, so these tests check what a
migrated database does, not what the model declares.
"""

from urllib.parse import urlencode

import pytest
import sqlalchemy as sa

from neurostore import service_migrations
from neurostore.database import db
from neurostore.extensions import cache
from neurostore.models import Analysis, BaseStudy, Fulltext, Point, Study, User
from neurostore.models.fulltext import refresh_fulltext_pointer
from neurostore.services.base_study_metadata_enrichment import merge_base_study
from neurostore.resources.text_search import pubmed_to_tsquery
from neurostore.tests.api.test_query_params import _list_endpoints

pytestmark = pytest.mark.anyio

TERM = "zyxomma"
PHRASE = '"zyxomma quellbrook"'


def _with_text(session, base_study, text, source="pubget"):
    """Give ``base_study`` a full text; the ORM listeners point it there when
    it is the preferred copy."""
    session.add(base_study)
    session.flush()
    fulltext = Fulltext(base_study_id=base_study.id, source=source, text=text)
    session.add(fulltext)
    session.flush()
    return fulltext


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
        base_study = BaseStudy(
            name=name or f"Plain heading number {i}",
            description=description
            or f"An abstract that reports a plain finding number {i} in detail.",
            level="group",
        )
        _with_text(
            session,
            base_study,
            text or f"Methods. We measured a plain quantity number {i} with care. " * 2,
        )
        return base_study

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
async def test_full_text_ranks_a_text_match_below_title_and_abstract_matches(
    auth_client, ranked_corpus, query
):
    """Here, where the text mentions it most often of all."""
    ids, total = await _search(auth_client, search=query, search_full_text="true")
    assert set(ids[:2]) == set(_ids(ranked_corpus, "title", "abstract"))
    assert ids[2:] == _ids(ranked_corpus, "full_text")
    assert total == 3


@pytest.mark.parametrize("query", [TERM, PHRASE])
async def test_search_matches_title_and_abstract_only_by_default(
    auth_client, ranked_corpus, query
):
    ids, total = await _search(auth_client, search=query)
    assert ids == _ids(ranked_corpus, "title", "abstract")
    assert total == 2


async def test_an_abstract_that_repeats_a_word_outranks_a_title_that_has_it_once(
    auth_client, session
):
    """Ranking is BM25: the abstract's boost of 2 against the title's 3 leaves
    room for term frequency."""
    for i in range(20):
        session.add(
            BaseStudy(
                name=f"Plain heading number {i}",
                description=f"An abstract that reports a plain finding number {i} here.",
                level="group",
            )
        )
    in_title = BaseStudy(
        name="Zyxomma heading number 20",
        description="An abstract that reports a plain finding number 20 here.",
        level="group",
    )
    repeated = BaseStudy(
        name="Plain heading number 21",
        description="Zyxomma, zyxomma, zyxomma and zyxomma in finding 21 here.",
        level="group",
    )
    session.add_all([in_title, repeated])
    session.commit()
    ids, _ = await _search(auth_client, search=TERM)
    assert ids == [repeated.id, in_title.id]


async def test_a_text_match_counts_less_than_an_abstract_match(auth_client, session):
    """The same mention ranks higher in an abstract than in the text: text-only
    matches usually rank lower, though a strong text match can still outrank
    a weak abstract one."""

    def filler(i):
        return f"Methods. We measured a plain quantity number {i} with care. " * 2

    for i in range(1, 21):
        _with_text(
            session,
            BaseStudy(
                name=f"Plain heading number {i}",
                description=f"An abstract that reports a plain finding number {i} here.",
                level="group",
            ),
            filler(i),
        )
    in_abstract = BaseStudy(
        name="Plain heading number 21",
        description="An abstract that reports a zyxomma finding number 21 here.",
        level="group",
    )
    _with_text(session, in_abstract, filler(21))
    in_text = BaseStudy(
        name="Plain heading number 22",
        description="An abstract that reports a plain finding number 22 here.",
        level="group",
    )
    _with_text(
        session, in_text, "Methods. We measured a zyxomma quantity number 22 with care. " * 2
    )
    session.commit()
    ids, _ = await _search(auth_client, search=TERM, search_full_text="true")
    assert ids == [in_abstract.id, in_text.id]


async def test_words_may_match_in_different_fields(auth_client, session):
    """With full text, each word must match the title, the abstract or the
    text; together they need not."""
    split = BaseStudy(name="Zyxomma in cortex", level="group")
    _with_text(session, split, "Methods. Quellbrook was measured.")
    session.commit()
    assert await _search(auth_client, search="zyxomma quellbrook") == ([], 0)
    assert await _search(
        auth_client, search="zyxomma quellbrook", search_full_text="true"
    ) == ([split.id], 1)


@pytest.fixture
def mixed_corpus(session):
    """7 papers without a full text and 6 with one, all matching."""
    without = [BaseStudy(name=f"Zyxomma study {i}", level="group") for i in range(7)]
    session.add_all(without)
    with_text = []
    for i in range(6):
        row = BaseStudy(name=f"Plain heading {i}", level="group")
        _with_text(session, row, "Methods. " + "Zyxomma was measured. " * (i + 1))
        with_text.append(row)
    session.commit()
    return without, with_text


@pytest.mark.parametrize("desc", ["true", "false"])
async def test_papers_with_and_without_a_full_text_page_together(
    auth_client, mixed_corpus, desc
):
    without, with_text = mixed_corpus
    everything, total = await _search(
        auth_client, search=TERM, search_full_text="true", page_size=100, desc=desc
    )
    assert total == 13
    assert set(everything) == {r.id for r in without + with_text}
    pages = []
    for page in (1, 2, 3, 4, 5):
        ids, total = await _search(
            auth_client,
            search=TERM,
            search_full_text="true",
            page=page,
            page_size=3,
            desc=desc,
        )
        assert total == 13
        pages.append(ids)
    assert [len(p) for p in pages] == [3, 3, 3, 3, 1]
    assert sum(pages, []) == everything


async def test_a_full_text_page_is_one_index_scan_per_index(
    auth_client, session, mixed_corpus
):
    """Each index returns its best matches straight from a Top K scan, and
    counts them, with every filter applied inside it."""
    statements = []

    def record(conn, cursor, statement, parameters, context, executemany):
        statements.append(cursor.mogrify(statement, parameters).decode())

    sa.event.listen(db.engine, "before_cursor_execute", record)
    try:
        await _search(
            auth_client, search=TERM, search_full_text="true", page=2, page_size=5
        )
    finally:
        sa.event.remove(db.engine, "before_cursor_execute", record)
    pages = [s for s in statements if "###" in s and "LIMIT" in s]
    counts = [s for s in statements if "###" in s and s.startswith("SELECT count(*)")]
    assert len(pages) == 1 and len(counts) == 2
    plan = "\n".join(session.execute(sa.text("EXPLAIN " + pages[0])).scalars())
    assert plan.count("TopKScanExecState") == 2
    for statement in pages + counts:
        plan = "\n".join(session.execute(sa.text("EXPLAIN " + statement)).scalars())
        assert "heap_filter" not in plan


async def test_the_full_text_search_keeps_the_list_filters(auth_client, session):
    owner = User.query.filter_by(external_id=auth_client.username).one()
    other = User(name="other", external_id="other-user-id")
    session.add(other)
    rows = {
        "public": BaseStudy(name="One", level="group", year=2020, authors="Smith J"),
        "inactive": BaseStudy(name="Two", level="group", is_active=False),
        "own_private": BaseStudy(name="Three", level="group", public=False, user=owner),
        "others_private": BaseStudy(name="Four", level="group", public=False, user=other),
        "meta": BaseStudy(name="Five", level="meta"),
        "old": BaseStudy(name="Six", level="group", year=1990, authors="Jones B"),
    }
    for row in rows.values():
        _with_text(session, row, "Methods. Zyxomma was measured.")
    session.commit()

    async def found(**params):
        ids, total = await _search(
            auth_client, search=TERM, search_full_text="true", **params
        )
        assert total == len(ids)
        return {k for k, r in rows.items() if r.id in ids}

    assert await found() == {"public", "own_private", "old"}
    assert await found(year_min=2000) == {"public"}
    assert await found(level="meta") == {"meta"}
    # A filter the copy does not hold: applied through the base studies.
    assert await found(authors="smith") == {"public"}


async def test_a_phrase_needs_its_words_in_order(auth_client, session):
    in_order = BaseStudy(name="Zyxomma quellbrook in cortex", level="group")
    apart = BaseStudy(name="Quellbrook, then zyxomma", level="group")
    session.add_all([in_order, apart])
    session.commit()
    phrase, _ = await _search(auth_client, search=PHRASE)
    words, _ = await _search(auth_client, search=PHRASE.strip('"'))
    assert phrase == [in_order.id]
    assert set(words) == {in_order.id, apart.id}


async def test_full_text_is_the_preferred_copy_only(auth_client, session):
    """A paper's full text is the copy its fulltext_id points to: another copy
    with the word does not make it match."""
    preferred_has_it = BaseStudy(name="One", level="group")
    _with_text(session, preferred_has_it, "Zyxomma here.")
    other_copy_has_it = BaseStudy(name="Two", level="group")
    _with_text(session, other_copy_has_it, "Nothing relevant.")
    _with_text(session, other_copy_has_it, "Zyxomma here.", source="ace")
    session.commit()
    assert await _search(auth_client, search=TERM) == ([], 0)
    ids, total = await _search(auth_client, search=TERM, search_full_text="true")
    assert ids == [preferred_has_it.id]
    assert total == 1


async def test_an_explicit_sort_searches_the_preferred_copy_only(auth_client, session):
    other_copy_has_it = BaseStudy(name="Two", level="group")
    _with_text(session, other_copy_has_it, "Nothing relevant.")
    _with_text(session, other_copy_has_it, "Zyxomma here.", source="ace")
    session.commit()
    assert await _search(
        auth_client, search=TERM, search_full_text="true", sort="name"
    ) == ([], 0)


async def test_a_moved_pointer_is_searched_at_once(auth_client, session):
    base_study = BaseStudy(name="One", level="group")
    preferred = _with_text(session, base_study, "Nothing relevant.")
    ace = _with_text(session, base_study, "Zyxomma here.", source="ace")
    session.commit()
    assert base_study.fulltext_id == preferred.id
    assert await _search(auth_client, search=TERM, search_full_text="true") == ([], 0)

    # A submitted copy ranks below ACE's; Core skips the listeners, so the
    # pointer moves only through refresh_fulltext_pointer.
    session.execute(
        sa.update(Fulltext)
        .where(Fulltext.id == preferred.id)
        .values(text_copy={"version": "submitted"})
    )
    refresh_fulltext_pointer(session.connection(), base_study.id)
    session.commit()
    session.refresh(base_study)
    assert base_study.fulltext_id == ace.id
    # The list's response cache is cleared by API writes, not by this one.
    cache.clear()
    ids, _ = await _search(auth_client, search=TERM, search_full_text="true")
    assert ids == [base_study.id]


COPIED = (
    "name",
    "description",
    "is_active",
    "public",
    "user_id",
    "level",
    "has_coordinates",
    "has_images",
    "is_oa",
    "year",
)


def _copies(session):
    """Each full text's copy of its base study's name, description, is_active,
    public and level, by full text id."""
    return {k: v[:2] + (v[2], v[3], v[5]) for k, v in _full_copies(session).items()}


def _full_copies(session):
    """Each full text's copy of every copied column, by full text id."""
    session.expire_all()
    return {
        f.id: tuple(getattr(f, column) for column in COPIED)
        for f in session.query(Fulltext)
    }


async def test_the_copy_follows_every_writer(auth_client, session):
    """The preferred full text holds the copy, every other row holds NULLs,
    whichever path writes the base study or its full texts."""
    nothing = (None, None, None, None, None)
    paper = BaseStudy(name="Zyxomma study", description="An abstract.", level="group")
    pubget = _with_text(session, paper, "Methods. Nothing relevant.")
    session.commit()
    assert _copies(session) == {pubget.id: ("Zyxomma study", "An abstract.", True, True, "group")}

    # An ORM edit of a copied column.
    paper.name = "Renamed study"
    paper.public = False
    session.commit()
    assert _copies(session)[pubget.id][:4] == ("Renamed study", "An abstract.", True, False)

    # A Core edit, which no ORM listener sees.
    session.execute(
        sa.update(BaseStudy).where(BaseStudy.id == paper.id).values(description="Changed.")
    )
    session.commit()
    assert _copies(session)[pubget.id][1] == "Changed."

    # A new, less preferred copy: the pointer stays.
    ace = _with_text(session, paper, "Methods. Zyxomma here.", source="ace")
    session.commit()
    assert _copies(session)[ace.id] == nothing

    # A new, preferred copy (insert): the copy moves to it.
    elsevier = Fulltext(base_study_id=paper.id, source="elsevier", text="Zyxomma.")
    session.add(elsevier)
    session.commit()
    copies = _copies(session)
    assert copies[elsevier.id][0] == "Renamed study"
    assert copies[pubget.id] == copies[ace.id] == nothing

    # Deleting the preferred copy: the pointer, then the copy, move on.
    session.delete(session.get(Fulltext, elsevier.id))
    session.commit()
    copies = _copies(session)
    assert copies[pubget.id][0] == "Renamed study"
    assert copies[ace.id] == nothing

    # fulltext_id set by any writer, here plain Core.
    session.execute(
        sa.update(BaseStudy).where(BaseStudy.id == paper.id).values(fulltext_id=ace.id)
    )
    session.commit()
    copies = _copies(session)
    assert copies[ace.id][0] == "Renamed study"
    assert copies[pubget.id] == nothing

    # refresh_fulltext_pointer puts it back on the preferred copy.
    refresh_fulltext_pointer(session.connection(), paper.id)
    session.commit()
    copies = _copies(session)
    assert copies[pubget.id][0] == "Renamed study"
    assert copies[ace.id] == nothing


@pytest.mark.parametrize("order", ["old_first", "new_first"])
async def test_a_full_text_moved_to_another_paper_carries_its_new_copy(session, order):
    """Whichever base study's pointer is refreshed first."""
    first = BaseStudy(name="First", level="group")
    moved = _with_text(session, first, "Methods. Moving text.")
    second = BaseStudy(name="Second", level="group")
    session.add(second)
    session.commit()
    session.execute(
        sa.update(Fulltext).where(Fulltext.id == moved.id).values(base_study_id=second.id)
    )
    for base_study in (first, second) if order == "old_first" else (second, first):
        refresh_fulltext_pointer(session.connection(), base_study.id)
    session.commit()
    assert _copies(session)[moved.id][0] == "Second"


async def test_an_edit_to_a_copied_title_is_searched_at_once(auth_client, session):
    """A text-only match whose title is edited to match ranks as a title
    match, and is listed once."""
    paper = BaseStudy(name="Plain heading", level="group")
    _with_text(session, paper, "Methods. Zyxomma was measured.")
    other = BaseStudy(name="Zyxomma in the title", level="group")
    _with_text(session, other, "Methods. Nothing relevant.")
    session.commit()
    ids, total = await _search(auth_client, search=TERM, search_full_text="true")
    assert (ids, total) == ([other.id, paper.id], 2)
    paper.name = "Zyxomma zyxomma"
    session.commit()
    cache.clear()
    ids, total = await _search(auth_client, search=TERM, search_full_text="true")
    assert (ids, total) == ([paper.id, other.id], 2)


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
    ("Amygdala volume", "Reward signals in memory tasks."),
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
    "the amygdala",
    "theory of mind",
    "memory OR the",
    "-the memory",
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


@pytest.mark.parametrize("query", ["...", "the", "the OR of"])
async def test_a_search_of_no_words_matches_nothing(auth_client, parity_corpus, query):
    assert await _search(auth_client, search=query) == ([], 0)


@pytest.fixture
def tied_corpus(session):
    """25 records with the same text, so the same score."""
    rows = [
        BaseStudy(name="Tied zyxomma", description="Same text.", level="group")
        for _ in range(25)
    ]
    for row in rows:
        _with_text(session, row, "Methods. Zyxomma, the same text.")
    session.commit()
    return [r.id for r in rows]


@pytest.mark.parametrize("desc", ["true", "false"])
@pytest.mark.parametrize("full_text", ["false", "true"])
async def test_ties_page_in_a_stable_order_and_each_record_appears_once(
    auth_client, session, tied_corpus, full_text, desc
):
    """Ties are broken by the id's hash, descending, whichever way the scores
    are ordered."""
    pages = []
    for page in (1, 2, 3):
        ids, total = await _search(
            auth_client,
            search=TERM,
            page=page,
            page_size=10,
            search_full_text=full_text,
            desc=desc,
        )
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
    texts = {
        f.base_study_id: f
        for f in session.query(Fulltext).filter(
            Fulltext.base_study_id.in_([c["full_text"].id, c["filler0"].id])
        )
    }
    texts[c["full_text"].id].text = "Methods. Nothing relevant here."
    texts[c["filler0"].id].text = "Methods. Zyxomma was measured."
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


def test_the_indexes_cover_the_searched_and_filtered_fields(session):
    def definition(name):
        return session.execute(
            sa.text("SELECT indexdef FROM pg_indexes WHERE indexname = :name"),
            {"name": name},
        ).scalar_one()

    base_studies = definition("ix_base_study_search")
    assert "USING paradedb" in base_studies
    for field in ("name", "description", "is_active", "public", "user_id", "level", "year"):
        assert field in base_studies
    assert "pubget_fulltext" not in base_studies and "ace_fulltext" not in base_studies
    fulltexts = definition("ix_fulltext_search")
    assert "ON public.fulltexts USING paradedb" in fulltexts
    for field in ("text", "name", "description", "is_active", "public", "user_id", "level"):
        assert f"({field})" in fulltexts or f"{field}::" in fulltexts or f" {field}," in fulltexts
    columns = session.execute(
        sa.text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'base_studies' AND column_name LIKE '%vector%'"
        )
    ).scalars()
    assert list(columns) == []


def test_the_indexes_and_their_tables_are_kept_fast_to_search(session):
    """Vacuum runs after a few rows change and always cleans the indexes, and
    each index has one segment, no mutable segment, whose buffered rows slow
    every search, and merge layers from 16 kB, so single-row writes' segments
    are merged before many accumulate."""

    def options(name):
        return session.execute(
            sa.text("SELECT reloptions FROM pg_class WHERE relname = :name"),
            {"name": name},
        ).scalar_one()

    for table, index in (
        ("base_studies", "ix_base_study_search"),
        ("fulltexts", "ix_fulltext_search"),
    ):
        assert {
            "vacuum_index_cleanup=on",
            "autovacuum_vacuum_scale_factor=0",
            "autovacuum_vacuum_threshold=50",
            "autovacuum_vacuum_insert_scale_factor=0",
            "autovacuum_vacuum_insert_threshold=50",
        } <= set(options(table))
        assert {
            "target_segment_count=1",
            "mutable_segment_rows=0",
            "background_layer_sizes=16kB, 64kB, 256kB, 1MB, 4MB, 16MB, 64MB, 256MB, 1GB",
        } <= set(options(index))


async def test_a_full_text_search_lists_every_match_unpaginated(auth_client, session):
    rows = []
    for i in range(35):
        row = BaseStudy(name=f"Plain heading {i}", level="group")
        if i % 5:
            _with_text(session, row, f"Methods. Zyxomma number {i}.")
        else:
            row.name = f"Zyxomma heading {i}"
            session.add(row)
        rows.append(row)
    session.commit()
    ids, total = await _search(
        auth_client, search=TERM, search_full_text="true", paginate="false"
    )
    assert total == 35
    assert sorted(ids) == sorted(r.id for r in rows)


@pytest.mark.parametrize("full_text", ["false", "true"])
async def test_page_zero_is_an_empty_page(auth_client, mixed_corpus, full_text):
    """As on every list."""
    assert await _search(
        auth_client, search=TERM, search_full_text=full_text, page_size=5, page=0
    ) == ([], 0)


def _move_via_the_orm(session, fulltext, base_study):
    """Move ``fulltext`` with its attributes expired, as after a commit, so the
    old owner is not in the attribute's history."""
    session.expire(fulltext)
    fulltext.base_study_id = base_study.id
    session.commit()


@pytest.fixture
def moved_text(session):
    """A's only full text moves to B, which has a preferred one of its own."""
    a = BaseStudy(name="Zyxomma first paper", level="group")
    moved = _with_text(session, a, "Methods. Zyxomma here.", source="ace")
    b = BaseStudy(name="Plain second paper", level="group")
    _with_text(session, b, "Methods. Zyxomma there.", source="pubget")
    session.commit()
    return a, b, moved


async def test_a_moved_full_text_leaves_each_paper_listed_once(
    auth_client, session, moved_text
):
    a, b, moved = moved_text
    _move_via_the_orm(session, moved, b)
    session.refresh(a)
    assert a.fulltext_id is None
    assert _copies(session)[moved.id] == (None, None, None, None, None)
    ids, total = await _search(auth_client, search=TERM, search_full_text="true")
    assert sorted(ids) == sorted([a.id, b.id])
    assert total == 2


async def test_a_moved_full_text_does_not_show_its_new_private_paper(
    auth_client, session, moved_text
):
    a, b, moved = moved_text
    other = User(name="other", external_id="other-user-id")
    session.add(other)
    session.flush()
    b.public, b.user_id = False, other.external_id
    session.commit()
    _move_via_the_orm(session, moved, b)
    a = session.get(BaseStudy, a.id)
    a.name = "Zyxomma first paper, renamed"
    session.commit()
    ids, _ = await _search(auth_client, search=TERM, search_full_text="true")
    assert ids == [a.id]


def test_a_full_text_moved_by_any_writer_drops_its_old_copy(session, moved_text):
    """Here plain Core: the copy goes at once, and the commit is refused while
    the old paper still points to the row."""
    a, b, moved = moved_text
    session.execute(
        sa.update(Fulltext).where(Fulltext.id == moved.id).values(base_study_id=b.id)
    )
    session.flush()
    assert session.execute(
        sa.select(Fulltext.name).where(Fulltext.id == moved.id)
    ).scalar_one() is None
    with pytest.raises(sa.exc.IntegrityError):
        session.commit()
    session.rollback()


def test_a_paper_cannot_be_left_pointing_at_another_paper_s_full_text(
    session, moved_text
):
    a, b, moved = moved_text
    theirs = session.query(Fulltext).filter_by(base_study_id=b.id, source="pubget").one()
    session.execute(
        sa.update(BaseStudy).where(BaseStudy.id == a.id).values(fulltext_id=theirs.id)
    )
    with pytest.raises(sa.exc.IntegrityError, match="fk_base_studies_fulltext_id"):
        session.commit()
    session.rollback()


def test_an_edit_between_a_move_and_its_repointing_leaves_the_new_owner_s_copy(
    session, moved_text
):
    """The key is checked only at commit, so within the transaction A still
    points to the row B now owns, and A's edit must not be copied onto it."""
    a, b, moved = moved_text
    session.execute(
        sa.update(Fulltext).where(Fulltext.id == moved.id).values(base_study_id=b.id)
    )
    session.execute(
        sa.update(BaseStudy).where(BaseStudy.id == b.id).values(fulltext_id=moved.id)
    )
    session.execute(
        sa.update(BaseStudy).where(BaseStudy.id == a.id).values(name="Renamed first")
    )
    refresh_fulltext_pointer(session.connection(), a.id)
    session.commit()
    assert _copies(session)[moved.id][0] == "Plain second paper"


async def test_each_copied_column_edited_alone_is_copied(auth_client, session):
    """Each edit is a Core update of one column, which only the trigger sees."""
    paper = BaseStudy(name="Plain heading", level="group", year=2001)
    text = _with_text(session, paper, "Methods. Zyxomma here.")
    session.commit()
    edits = {
        "is_active": False,
        "public": False,
        "user_id": "someone-id",
        "level": "meta",
        "has_coordinates": True,
        "has_images": True,
        "is_oa": True,
        "year": 2020,
        "description": "Edited abstract.",
    }
    session.add(User(name="someone", external_id="someone-id"))
    session.commit()
    for column, value in edits.items():
        session.execute(
            sa.update(BaseStudy).where(BaseStudy.id == paper.id).values({column: value})
        )
        session.commit()
        copy = dict(zip(COPIED, _full_copies(session)[text.id]))
        assert copy[column] == value, column


@pytest.fixture
def filtered_pair(session):
    """Two papers that match in their text alone, one of which each case below
    gives the one value its filter keeps."""
    inside = BaseStudy(name="Plain inside", level="group")
    outside = BaseStudy(name="Plain outside", level="group")
    _with_text(session, inside, "Methods. Zyxomma inside.")
    _with_text(session, outside, "Methods. Zyxomma outside.")
    session.commit()
    return inside, outside


def _core_edit(session, base_study, **values):
    session.execute(sa.update(BaseStudy).where(BaseStudy.id == base_study.id).values(values))
    session.commit()


async def _setup_user_id(session, inside, outside, me):
    other = User(name="other", external_id="other-user-id")
    session.add(other)
    session.commit()
    _core_edit(session, inside, user_id=me)
    _core_edit(session, outside, user_id=other.external_id)
    return {"user_id": me}


async def _setup_spatial_at_zero(session, inside, outside, me):
    study = Study(name="Located", base_study_id=inside.id)
    session.add(study)
    session.flush()
    analysis = Analysis(name="Located analysis", study_id=study.id)
    session.add(analysis)
    session.flush()
    session.add(Point(x=0, y=0, z=0, analysis_id=analysis.id))
    session.commit()
    return {"x": 0, "y": 0, "z": 0, "radius": 0}


async def _setup_neurovault(session, inside, outside, me):
    session.add(
        Study(
            name="From NeuroVault",
            base_study_id=inside.id,
            source="neurovault",
            source_id="nv-7",
        )
    )
    session.commit()
    return {"neurovault_id": "nv-7"}


async def _setup_map_type(session, inside, outside, me):
    _core_edit(session, inside, has_images=True, has_z_maps=True)
    return {"map_type": "z"}


async def _setup_data_type(session, inside, outside, me):
    _core_edit(session, inside, has_coordinates=True)
    return {"data_type": "coordinate"}


async def _setup_is_oa(session, inside, outside, me):
    _core_edit(session, inside, is_oa=True)
    _core_edit(session, outside, is_oa=False)
    return {"is_oa": "true"}


async def _setup_level(session, inside, outside, me):
    _core_edit(session, inside, level="meta")
    return {"level": "meta"}


async def _setup_year(session, inside, outside, me):
    _core_edit(session, inside, year=2020)
    _core_edit(session, outside, year=1990)
    return {"year_min": 2000}


async def _setup_inactive(session, inside, outside, me):
    _core_edit(session, outside, is_active=False)
    return {}


async def _setup_private(session, inside, outside, me):
    other = User(name="other", external_id="other-user-id")
    session.add(other)
    session.commit()
    _core_edit(session, outside, public=False, user_id=other.external_id)
    return {}


async def _setup_own_private(session, inside, outside, me):
    _core_edit(session, inside, public=False, user_id=me)
    _core_edit(session, outside, public=False)
    return {}


@pytest.mark.parametrize(
    "setup",
    [
        _setup_user_id,
        _setup_spatial_at_zero,
        _setup_neurovault,
        _setup_map_type,
        _setup_data_type,
        _setup_is_oa,
        _setup_level,
        _setup_year,
        _setup_inactive,
        _setup_private,
        _setup_own_private,
    ],
    ids=lambda f: f.__name__.removeprefix("_setup_"),
)
async def test_every_list_filter_applies_to_the_full_text_side(
    auth_client, session, filtered_pair, setup
):
    inside, outside = filtered_pair
    params = await setup(session, inside, outside, auth_client.username)
    ids, total = await _search(auth_client, search=TERM, search_full_text="true", **params)
    assert (ids, total) == ([inside.id], 1)


async def test_semantic_search_applies_to_the_full_text_side(
    auth_client, session, filtered_pair, mock_get_embedding
):
    """With no embeddings stored, semantic search matches nothing, so neither
    side lists a paper."""
    params = {"semantic_search": "zyxomma", "distance_threshold": 1}
    assert await _search(auth_client, search=TERM, search_full_text="true", **params) == ([], 0)
    assert await _search(auth_client, search="plain", **params) == ([], 0)


async def test_a_superseded_paper_drops_out_of_full_text_search(auth_client, session):
    keeper = BaseStudy(name="Plain keeper", level="group")
    old = BaseStudy(name="Plain duplicate", level="group")
    _with_text(session, keeper, "Methods. Zyxomma kept.")
    _with_text(session, old, "Methods. Zyxomma duplicated.")
    session.commit()
    merge_base_study(keeper, old)
    session.commit()
    cache.clear()
    ids, total = await _search(auth_client, search=TERM, search_full_text="true")
    assert (ids, total) == ([keeper.id], 1)


def test_the_migration_goes_down_and_up_over_existing_rows(session):
    """More than a batch of papers, each with a preferred and another full
    text: the downgrade restores the tsvector search, and the upgrade copies
    onto every preferred row and no other."""
    papers = [
        {"id": f"paper{i:05d}", "name": f"Zyxomma paper {i}",
         "description": "An abstract on quokkas.", "level": "group"}
        for i in range(1005)
    ]
    texts = [
        {"id": f"{p['id']}-{source}", "base_study_id": p["id"], "source": source,
         "sha256": f"{i:060d}{n:04d}", "text": f"Methods. Quellbrook {source}."}
        for i, p in enumerate(papers) for n, source in enumerate(("pubget", "ace"))
    ]
    with session.bind.begin() as conn:
        conn.execute(BaseStudy.__table__.insert(), papers)
        conn.execute(Fulltext.__table__.insert(), texts)
        conn.execute(sa.text(
            "UPDATE base_studies SET fulltext_id = id || '-pubget' WHERE id LIKE 'paper%'"
        ))
    session.remove()

    def scalar(sql):
        with session.bind.connect() as conn:
            return conn.execute(sa.text(sql)).scalar()

    try:
        service_migrations.downgrade("e7a9c1d3f5b8")
        assert scalar(
            "SELECT count(*) FROM base_studies "
            "WHERE __ts_vector__ @@ to_tsquery('english', 'zyxomma & quokka')"
        ) == 1005
        assert scalar(
            "SELECT indexdef FROM pg_indexes WHERE indexname = 'ix_base_study___ts_vector__'"
        ).endswith("USING gin (__ts_vector__)")
        assert scalar(
            "SELECT count(*) FROM information_schema.columns "
            "WHERE table_name = 'fulltexts' AND column_name = 'is_active'"
        ) == 0
        assert scalar("SELECT count(*) FROM pg_trigger WHERE tgname LIKE '%copy%'") == 0
        assert scalar(
            "SELECT count(*) FROM pg_class WHERE relname IN ('base_studies', 'fulltexts') "
            "AND reloptions IS NOT NULL"
        ) == 0
        # A pointer at another paper's text, which the old key allowed.
        with session.bind.begin() as conn:
            conn.execute(sa.text(
                "UPDATE base_studies SET fulltext_id = 'paper00001-ace' WHERE id = 'paper00000'"
            ))
    finally:
        service_migrations.upgrade("heads")
        db.engine.dispose()
    assert scalar(
        "SELECT count(*) FROM fulltexts WHERE source = 'pubget' AND name LIKE 'Zyxomma paper %'"
        " AND is_active AND level = 'group'"
    ) == 1005
    assert scalar(
        "SELECT count(*) FROM fulltexts WHERE source = 'ace' AND is_active IS NOT NULL"
    ) == 0
    # Re-pointed to its own best text before the key was validated.
    assert scalar(
        "SELECT fulltext_id FROM base_studies WHERE id = 'paper00000'"
    ) == "paper00000-pubget"
    assert scalar(
        "SELECT convalidated FROM pg_constraint WHERE conname = 'fk_base_studies_fulltext_id'"
    ) is True
