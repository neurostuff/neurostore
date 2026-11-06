"""Public aggregate queries over the public datasets (neurostore/public_query.py)."""

from datetime import datetime, timezone

import pytest
import sqlalchemy as sa

from neurostore import public_query
from neurostore.models import (
    Analysis,
    Author,
    BaseStudy,
    BaseStudyAuthor,
    BaseStudyAuthorAffiliation,
    Study,
    University,
    User,
)
from neurostore.models.journals import Journal
from neurostore.tests.request_utils import AsyncClient

pytestmark = pytest.mark.anyio


def _at(*args):
    return datetime(*args, tzinfo=timezone.utc)


@pytest.fixture
def corpus(session):
    """Three public base studies in two journals and years, one private and one
    inactive; their authors and institutions; public and private studies; and two
    Compose meta-analyses run in May and June 2024."""
    one = Journal(openalex_id="S1", kind="journal", title="Journal One")
    two = Journal(openalex_id="S2", kind="journal", title="Journal Two")
    memory = BaseStudy(
        name="Working memory in rats", year=2020, has_coordinates=True
    )
    faces = BaseStudy(name="Faces", year=2020, has_images=True)
    plain = BaseStudy(name="Plain", year=2021)
    hidden = BaseStudy(name="Hidden memory", year=2019, public=False, has_coordinates=True)
    retired = BaseStudy(name="Retired memory", year=2018, is_active=False)
    session.add_all([one, two, memory, faces, plain, hidden, retired])
    session.flush()
    memory.journal_id = faces.journal_id = one.id
    plain.journal_id = two.id

    ada = Author(name="Ada", orcid="0000-0000-0000-0001")
    bo = Author(name="Bo")
    north = University(ror="r1", name="North University", country="US")
    south = University(ror="r2", name="South Institute", country="DE")
    session.add_all([ada, bo, north, south])
    session.flush()

    def write(base_study, author, position, *universities):
        authorship = BaseStudyAuthor(
            base_study_id=base_study.id, author_id=author.id, position=position, name=author.name
        )
        session.add(authorship)
        session.flush()
        for place, university in enumerate(universities):
            session.add(
                BaseStudyAuthorAffiliation(
                    base_study_author_id=authorship.id,
                    position=place,
                    text=university.name,
                    university_id=university.id,
                )
            )

    write(memory, ada, 0, north)
    write(memory, bo, 1, north)
    write(faces, ada, 0, south)
    write(plain, bo, 0, north)
    write(hidden, ada, 0, south)

    alice = User(name="alice", external_id="alice-id")
    email = User(name="bob@example.org", external_id="bob-id")
    session.add_all([alice, email])
    session.flush()
    studies = [
        Study(name="alice 1", base_study=memory, user=alice),
        Study(name="alice 2", base_study=faces, user=alice),
        Study(name="alice private", base_study=plain, user=alice, public=False),
        Study(name="bob 1", base_study=plain, user=email),
    ]
    may = Study(name="May project", level="meta", user=alice)
    june = Study(name="June project", level="meta", user=alice)
    session.add_all([*studies, may, june])
    session.flush()
    session.add_all(
        [
            Analysis(name="May run", study=may, created_at=_at(2024, 5, 11)),
            Analysis(name="June run", study=june, created_at=_at(2024, 6, 1)),
        ]
    )
    session.commit()
    public_query.refresh_datasets()
    return {"hidden": hidden.id, "retired": retired.id}


@pytest.fixture
async def anonymous(app):
    client = AsyncClient(token=None, asgi_app=app.asgi_app)
    try:
        yield client
    finally:
        await client.aclose()


async def _rows(client, path):
    resp = await client.get(path)
    assert resp.status_code == 200, resp.json()
    return resp.json()["rows"]


async def test_the_listing_is_the_allow_list_and_matches_each_view(
    anonymous, corpus, session
):
    listed = (await anonymous.get("/api/query/")).json()
    assert [d["name"] for d in listed["results"]] == list(public_query.DATASETS)
    for dataset in public_query.DATASETS.values():
        view_columns = session.execute(
            sa.text(
                "SELECT attname FROM pg_attribute WHERE attrelid = cast(:view AS regclass) "
                "AND attnum > 0 AND NOT attisdropped ORDER BY attnum"
            ),
            {"view": f"public_query.{dataset.view}"},
        ).scalars()
        assert list(view_columns) == list(dataset.columns), dataset.name


async def test_base_studies_per_year(anonymous, corpus):
    rows = await _rows(
        anonymous,
        "/api/query/base-studies?$select=year, count(*) AS base_studies&$group=year&$order=year",
    )
    assert rows == [[2020, 2], [2021, 1]]


async def test_base_studies_per_journal(anonymous, corpus):
    assert await _rows(
        anonymous, "/api/query/journals?$select=title, base_studies&$order=base_studies DESC"
    ) == [["Journal One", 2], ["Journal Two", 1]]
    assert await _rows(
        anonymous,
        "/api/query/base-studies?$select=journal, count(*) AS n&$where=year = 2020"
        "&$group=journal&$order=n DESC",
    ) == [["Journal One", 2]]


async def test_base_studies_per_author_ranked_by_those_with_data(anonymous, corpus):
    assert await _rows(
        anonymous,
        "/api/query/authors?$select=name, base_studies_with_data, base_studies"
        "&$order=base_studies_with_data DESC, base_studies DESC",
    ) == [["Ada", 2, 2], ["Bo", 1, 2]]
    assert await _rows(
        anonymous,
        "/api/query/authorships?$select=author_name, "
        "sum(case(has_coordinates OR has_images, 1, true, 0)) AS with_data, count(*) AS n"
        "&$group=author_name&$order=with_data DESC",
    ) == [["Ada", 2, 2], ["Bo", 1, 2]]


async def test_base_studies_per_institution(anonymous, corpus):
    assert await _rows(
        anonymous, "/api/query/institutions?$select=name, base_studies&$order=base_studies DESC"
    ) == [["North University", 2], ["South Institute", 1]]
    assert await _rows(
        anonymous,
        "/api/query/affiliations?$select=institution, count(*) AS n&$where=country = 'US'"
        "&$group=institution",
    ) == [["North University", 2]]


async def test_users_by_the_public_studies_they_own(anonymous, corpus):
    resp = await anonymous.get(
        "/api/query/studies?$select=username, count(*) AS studies"
        "&$group=username&$order=studies DESC"
    )
    # alice's two public versions and two meta studies; bob's email-like name is null.
    assert resp.json()["rows"] == [["alice", 4], [None, 1]]
    assert "bob" not in resp.text and "-id" not in resp.text


async def test_compose_meta_analyses_per_month(anonymous, corpus):
    rows = await _rows(
        anonymous,
        "/api/query/analyses?$select=date_trunc_ym(created_at) AS month, count(*) AS runs"
        "&$where=level = 'meta' AND base_study_id IS NULL"
        " AND created_at BETWEEN '2024-01-01' AND '2024-12-31'"
        "&$group=month&$order=month",
    )
    assert [(month[:7], n) for month, n in rows] == [("2024-05", 1), ("2024-06", 1)]


async def test_text_search_counts_matching_base_studies(anonymous, corpus):
    rows = await _rows(
        anonymous,
        "/api/query/base-studies?$select=year, count(*) AS n&$q=memory&$group=year",
    )
    assert rows == [[2020, 1]]


async def test_private_and_inactive_base_studies_are_nowhere(anonymous, corpus):
    for path in [
        "/api/query/base-studies?$select=id&$limit=1000",
        "/api/query/authorships?$select=base_study_id&$limit=1000",
        "/api/query/affiliations?$select=base_study_id&$limit=1000",
    ]:
        ids = {row[0] for row in await _rows(anonymous, path)}
        assert ids and not ids & {corpus["hidden"], corpus["retired"]}, path
    private = "/api/query/studies?$select=name&$where=name = 'alice private'"
    assert await _rows(anonymous, private) == []


@pytest.mark.parametrize(
    "path",
    [
        "/api/query/base-studies?$select=pg_sleep(1)",
        "/api/query/studies?$select=user_id",
        "/api/query/base-studies?$select=description",
        "/api/query/base-studies?$where=year = 1; drop table users",
        "/api/query/base-studies?$where=year = (select 1)",
        "/api/query/base-studies?$where=year::text = '1'",
        "/api/query/base-studies?$select=year -- comment",
        "/api/query/base-studies?$where=count(*) > 1",
        "/api/query/base-studies?$where=title = 1",
        "/api/query/base-studies?$select=year, title&$group=year",
        "/api/query/base-studies?$having=count(*) > 1",
        "/api/query/journals?$q=memory",
        "/api/query/base-studies?$limit=5000",
        "/api/query/base-studies?$where=created_at > 'yesterday'",
    ],
)
async def test_anything_outside_the_grammar_is_refused(anonymous, corpus, path):
    resp = await anonymous.get(path)
    assert resp.status_code == 400, (path, resp.status_code, resp.text)


async def test_an_unknown_dataset_is_not_found(anonymous, corpus):
    assert (await anonymous.get("/api/query/users")).status_code == 404


async def test_the_reader_role_reads_only_the_datasets(corpus):
    with public_query._engine().connect() as connection, connection.begin():
        connection.exec_driver_sql(f"SET LOCAL ROLE {public_query.READER}")
        count = "SELECT count(*) FROM public_query.base_studies"
        assert connection.exec_driver_sql(count).scalar()
        with pytest.raises(sa.exc.ProgrammingError, match="permission denied"):
            connection.exec_driver_sql("SELECT external_id FROM public.users")


async def test_a_query_over_the_cost_limit_needs_an_api_key(
    anonymous, auth_client, app, corpus, monkeypatch
):
    monkeypatch.setattr(public_query, "ANONYMOUS_COST", 0)
    path = "/api/query/base-studies?$select=year, count(*) AS n&$group=year&$where=year > 2000"
    refused = await anonymous.get(path)
    assert refused.status_code == 422
    assert "planned cost" in refused.text

    created = await auth_client.post("/api/api-keys/", data={"name": "q", "scopes": ["read"]})
    keyed = AsyncClient(token=created.json()["key"], asgi_app=app.asgi_app)
    try:
        assert (await keyed.get(path)).status_code == 200
    finally:
        await keyed.aclose()


async def test_an_unchanged_answer_is_a_304_by_its_etag(anonymous, corpus):
    path = "/api/query/base-studies?$select=year&$group=year"
    first = await anonymous.get(path)
    assert first.headers["Cache-Control"] == "public, max-age=300"
    again = await anonymous.get(path, headers={"If-None-Match": first.headers["ETag"]})
    assert again.status_code == 304


async def test_a_refresh_changes_the_answer_and_its_etag(anonymous, corpus, session):
    path = "/api/query/base-studies?$select=count(*) AS n"
    before = await anonymous.get(path)
    session.add(BaseStudy(name="New", year=2022))
    session.commit()
    assert (await anonymous.get(path)).json()["rows"] == before.json()["rows"]

    public_query.refresh_datasets()
    after = await anonymous.get(path)
    assert after.json()["rows"] == [[before.json()["rows"][0][0] + 1]]
    assert after.headers["ETag"] != before.headers["ETag"]


async def test_no_free_connection_is_a_503(anonymous, corpus, monkeypatch):
    class Exhausted:
        def connect(self):
            raise sa.exc.TimeoutError()

    monkeypatch.setattr(public_query, "_engine", lambda: Exhausted())
    resp = await anonymous.get("/api/query/base-studies?$select=title&$where=year = 1999")
    assert resp.status_code == 503
    assert resp.headers["Retry-After"] == "1"


async def test_text_patterns(anonymous, corpus):
    base = "/api/query/base-studies?$select=title&$order=title"
    assert await _rows(anonymous, base + "&$where=starts_with(title, 'Work')") == [
        ["Working memory in rats"]
    ]
    assert await _rows(anonymous, base + "&$where=lower(title) LIKE '%a%'") == [
        ["Faces"],
        ["Plain"],
        ["Working memory in rats"],
    ]
    assert await _rows(anonymous, base + "&$where=starts_with(title, '%')") == []
