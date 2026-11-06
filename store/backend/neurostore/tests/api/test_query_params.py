from urllib.parse import urlencode

import pytest
import sqlalchemy as sa

from neurostore.database import db
from neurostore.models import Analysis, BaseStudy, Study
from neurostore.schemas.data import (
    AnalysisSchema,
    StringOrNested,
    StudySchema,
    StudysetSchema,
)
from neurostore.services.has_media_flags import recompute_media_flags
from neurostore.tests.conftest import (
    invalid_queries,
    negation_only_queries,
    valid_queries,
)

pytestmark = pytest.mark.anyio


@pytest.mark.parametrize("nested", ["true", "false"])
@pytest.mark.parametrize(
    "resource_schema",
    [
        ("studysets", StudysetSchema()),
        ("studies", StudySchema()),
        ("analyses", AnalysisSchema()),
    ],
)
async def test_nested(auth_client, ingest_neurosynth, nested, resource_schema, session):
    resource, schema = resource_schema
    resp = await auth_client.get(f"/api/{resource}/?nested={nested}")
    fields = [f for f in schema.fields if isinstance(schema.fields[f], StringOrNested)]
    for field in fields:
        if nested == "true":
            try:
                assert isinstance(resp.json()["results"][0][field][0], dict)
            except IndexError:
                continue
        else:
            try:
                assert isinstance(resp.json()["results"][0][field][0], str)
            except IndexError:
                continue


async def test_user_id(auth_client, user_data, session):
    from neurostore.resources.users import User

    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    resp = await auth_client.get(f"/api/studies/?user_id={user.external_id}")
    for study in resp.json()["results"]:
        assert study["user"] == user.external_id


async def test_source_id(auth_client, ingest_neurosynth, session):
    # Ordered so the study under test does not depend on the order postgres
    # happens to return rows in; an unpinned pick made this test fail on only
    # some runs, depending on how many analyses the chosen study had.
    study = Study.query.order_by(Study.id).first()
    post = await auth_client.post(f"/api/studies/?source_id={study.id}", data={})
    get = await auth_client.get(f"/api/studies/?source_id={study.id}&nested=true")

    assert post.json() == get.json()["results"][0]


async def test_source_id_body_matches_stored_analyses(
    auth_client, ingest_neurosynth, session
):
    """A clone's POST body must agree with the rows it just wrote.

    Cloning a study makes `recompute_media_flags` flip the new analyses' flags
    with a Core UPDATE, which bumps `updated_at` as part of the SET. The body is
    dumped from the session before the commit, so analyses left stale there used
    to report `updated_at: null` for rows the database had already stamped.
    """
    # A study with several analyses: cloning one whose analyses all stay in
    # sync never exercised the stale read, so pick the widest study ingested.
    study_id = db.session.execute(
        sa.select(Analysis.study_id)
        .group_by(Analysis.study_id)
        .order_by(sa.func.count().desc(), Analysis.study_id)
        .limit(1)
    ).scalar_one()
    study = db.session.get(Study, study_id)
    assert study is not None, "fixture should ingest a study with analyses"

    post = await auth_client.post(f"/api/studies/?source_id={study.id}", data={})
    assert post.status_code == 200
    clone = post.json()

    stored = {
        row.id: row.updated_at
        for row in db.session.execute(
            sa.select(Analysis.id, Analysis.updated_at).where(
                Analysis.study_id == clone["id"]
            )
        ).all()
    }
    assert stored, "clone should have analyses"

    for analysis in clone["analyses"]:
        if stored[analysis["id"]] is not None:
            assert analysis["updated_at"] is not None, (
                f"analysis {analysis['id']} reported updated_at=null while the "
                "database had already stamped it"
            )


@pytest.mark.parametrize("endpoint", ["studies", "base-studies"])
async def test_data_type(
    auth_client, ingest_neurosynth, ingest_neurovault, session, endpoint
):
    get_coord = await auth_client.get(f"/api/{endpoint}/?data_type=coordinate")
    assert get_coord.status_code == 200
    get_img = await auth_client.get(f"/api/{endpoint}/?data_type=image")
    assert get_img.status_code == 200
    get_both = await auth_client.get(f"/api/{endpoint}/?data_type=both")
    assert get_both.status_code == 200
    assert (
        len(get_coord.json()["results"]) + len(get_img.json()["results"])
        == len(get_both.json()["results"])
        != 0
    )


@pytest.mark.parametrize("endpoint", ["studies", "base-studies"])
async def test_map_type_filter(auth_client, session, endpoint):
    prefix = f"MapTypeFilter{endpoint.replace('-', '')}"
    z_doi = f"10.1000/{prefix.lower()}-z"
    t_doi = f"10.1000/{prefix.lower()}-t"
    beta_var_doi = f"10.1000/{prefix.lower()}-beta-var"
    any_doi = f"10.1000/{prefix.lower()}-any"
    base_payload = {
        "pmid": "950001",
        "doi": z_doi,
        "name": f"{prefix}-Z",
        "level": "group",
        "analyses": [{"name": "z-analysis", "images": [{"value_type": "Z map"}]}],
    }
    t_payload = {
        "pmid": "950002",
        "doi": t_doi,
        "name": f"{prefix}-T",
        "level": "group",
        "analyses": [{"name": "t-analysis", "images": [{"value_type": "T map"}]}],
    }
    beta_var_payload = {
        "pmid": "950003",
        "doi": beta_var_doi,
        "name": f"{prefix}-BetaVariance",
        "level": "group",
        "analyses": [
            {
                "name": "beta-var-analysis",
                "images": [{"value_type": "U"}, {"value_type": "V"}],
            }
        ],
    }
    any_payload = {
        "pmid": "950004",
        "doi": any_doi,
        "name": f"{prefix}-Any",
        "level": "group",
        "analyses": [{"name": "any-analysis", "images": [{"value_type": "Other"}]}],
    }

    created_study_ids = []
    for payload in [base_payload, t_payload, beta_var_payload, any_payload]:
        response = await auth_client.post("/api/studies/", data=payload)
        assert response.status_code == 200
        created_study_ids.append(response.json()["id"])

    base_study_ids = {
        Study.query.filter_by(id=study_id).one().base_study_id
        for study_id in created_study_ids
    }
    recompute_media_flags(base_study_ids)
    session.commit()

    z_match = await auth_client.get(f"/api/{endpoint}/?doi={z_doi}&map_type=z")
    z_miss = await auth_client.get(f"/api/{endpoint}/?doi={t_doi}&map_type=z")
    t_match = await auth_client.get(f"/api/{endpoint}/?doi={t_doi}&map_type=t")
    t_miss = await auth_client.get(f"/api/{endpoint}/?doi={z_doi}&map_type=t")
    beta_var_match = await auth_client.get(
        f"/api/{endpoint}/?doi={beta_var_doi}&map_type=beta_variance"
    )
    beta_var_miss = await auth_client.get(
        f"/api/{endpoint}/?doi={z_doi}&map_type=beta_variance"
    )
    any_match = await auth_client.get(f"/api/{endpoint}/?doi={any_doi}&map_type=any")
    any_match_z = await auth_client.get(f"/api/{endpoint}/?doi={z_doi}&map_type=any")

    assert z_match.status_code == 200
    assert z_miss.status_code == 200
    assert t_match.status_code == 200
    assert t_miss.status_code == 200
    assert beta_var_match.status_code == 200
    assert beta_var_miss.status_code == 200
    assert any_match.status_code == 200
    assert any_match_z.status_code == 200

    assert {row["name"] for row in z_match.json()["results"]} == {f"{prefix}-Z"}
    assert z_miss.json()["results"] == []
    assert {row["name"] for row in t_match.json()["results"]} == {f"{prefix}-T"}
    assert t_miss.json()["results"] == []
    assert {row["name"] for row in beta_var_match.json()["results"]} == {
        f"{prefix}-BetaVariance"
    }
    assert beta_var_miss.json()["results"] == []
    assert {row["name"] for row in any_match.json()["results"]} == {f"{prefix}-Any"}
    assert {row["name"] for row in any_match_z.json()["results"]} == {f"{prefix}-Z"}


async def test_page_size(auth_client, ingest_neurosynth, session):
    num_studies = Study.query.count()
    results = []
    for i in range(1, num_studies + 1):
        get_page_size = await auth_client.get(f"/api/studies/?page_size=1&page={i}")
        assert get_page_size.status_code == 200
        results.append(get_page_size.json()["results"][0]["id"])
    assert len(set(results)) == num_studies


async def test_common_queries(auth_client, ingest_neurosynth, session):
    study = BaseStudy.query.filter(BaseStudy.pmid.isnot(None)).first()

    pmid_search = await auth_client.get(f"/api/base-studies/?pmid={study.pmid}")

    total_search = await auth_client.get(f"/api/base-studies/?search={study.pmid}")

    assert pmid_search.status_code == total_search.status_code == 200
    assert len(pmid_search.json()["results"]) == len(total_search.json()["results"])


async def test_multiword_queries(auth_client, ingest_neurosynth, session):
    study = BaseStudy.query.first()
    name = study.name
    word_list = name.split(" ")
    single_word = word_list[-1]
    multiple_words = " ".join(word_list[-3:])

    single_word_search = await auth_client.get(
        f"/api/base-studies/?search={single_word}"
    )
    assert single_word_search.status_code == 200
    assert len(single_word_search.json()["results"]) > 0

    multi_word_search = await auth_client.get(
        f"/api/base-studies/?search={multiple_words}"
    )
    assert multi_word_search.status_code == 200
    assert len(multi_word_search.json()["results"]) > 0


async def test_dash_is_a_not_operator(auth_client, ingest_neurosynth, session):
    """`-term` must exclude, matching the documented PubMed-style NOT (issue #1745)."""
    study = BaseStudy.query.first()
    word = study.name.split(" ")[-1]

    included = await auth_client.get(f"/api/base-studies/?search={word}")
    assert included.status_code == 200
    assert len(included.json()["results"]) > 0

    for excluded_query in (f"{word} -{word}", f"{word} NOT {word}"):
        url_safe_query = urlencode({"search": excluded_query})
        excluded = await auth_client.get(f"/api/base-studies/?{url_safe_query}")
        assert excluded.status_code == 200
        assert excluded.json()["results"] == []


@pytest.mark.parametrize("query, expected", negation_only_queries)
async def test_negation_only_queries_are_rejected(
    query, expected, auth_client, ingest_neurosynth, session
):
    """A query with no positive term cannot use the GIN index.

    Postgres falls back to a sequential scan matching nearly every record
    (~650ms on a 41k-row corpus, versus ~3ms for an indexed term), so the
    endpoint refuses rather than serving it.
    """
    url_safe_query = urlencode({"search": query})
    search = await auth_client.get(f"/api/base-studies/?{url_safe_query}")
    assert search.status_code == 400


@pytest.mark.parametrize("query, expected", valid_queries)
async def test_valid_pubmed_queries(
    query, expected, auth_client, ingest_neurosynth, session
):
    search = await auth_client.get(f"/api/base-studies/?search={query}")
    assert search.status_code == 200


@pytest.mark.parametrize("query, expected", invalid_queries)
async def test_invalid_pubmed_queries(
    query, expected, auth_client, ingest_neurosynth, session
):
    url_safe_query = urlencode({"search": query})
    search = await auth_client.get(f"/api/base-studies/?{url_safe_query}")
    assert search.status_code == 400


async def test_error_responses_carry_a_correlation_id(auth_client, session):
    """A failing request must be traceable from the client to the server log."""
    url_safe_query = urlencode({"search": "AND OR"})
    result = await auth_client.get(f"/api/base-studies/?{url_safe_query}")

    assert result.status_code == 400
    request_id = result.headers.get("X-Request-ID")
    assert request_id
    # the id in the body is the one the server logged, not a fresh one
    assert result.json()["request_id"] == request_id
    assert result.json()["timestamp"]


async def test_request_id_is_echoed_when_the_caller_supplies_one(
    auth_client, session
):
    result = await auth_client.get(
        "/api/base-studies/does-not-exist",
        headers={"X-Request-ID": "client-supplied-id"},
    )

    assert result.status_code == 404
    assert result.headers.get("X-Request-ID") == "client-supplied-id"
    assert result.json()["request_id"] == "client-supplied-id"


async def test_correlation_id_is_readable_cross_origin(auth_client, session):
    """A browser can only read the id if CORS exposes the header."""
    result = await auth_client.get(
        "/api/base-studies/does-not-exist",
        headers={"Origin": "https://client.example"},
    )

    assert "X-Request-ID" in result.headers["Access-Control-Expose-Headers"]


@pytest.fixture
def search_corpus(session):
    """Four base studies mentioning "quokkaflux" three, two, one and zero times.

Term frequency and field weight order these the same way; the field
ranking itself is pinned in test_base_study_search.py.
"""
    rows = {
        "title": BaseStudy(
            name="Quokkaflux responses in cortex",
            description="Quokkaflux is measured. Quokkaflux is large.",
            pmid="90000001",
            doi="10.1000/quokka.title",
            authors="Smith J, Doe A",
            publication="Journal of Marsupial Imaging",
            year=2010,
            level="group",
        ),
        "abstract": BaseStudy(
            name="Plain heading",
            description="This abstract mentions quokkaflux and quokkaflux.",
            pmid="90000002",
            doi="10.1000/quokka.abstract",
            authors="Jones B",
            publication="Neuro Letters",
            year=2015,
            level="group",
        ),
        "single": BaseStudy(
            name="Another heading",
            description="Mentions quokkaflux once.",
            pmid="90000003",
            doi="10.1000/other.single",
            authors="Smith K",
            publication="Neuro Letters",
            year=2020,
            level="group",
        ),
        "miss": BaseStudy(
            name="Nothing relevant",
            description="Cites pmid 90000002 in passing.",
            pmid="90000004",
            doi="10.1000/other.miss",
            authors="Nobody N",
            publication="Other Journal",
            year=2021,
            level="group",
        ),
    }
    session.add_all(rows.values())
    session.commit()
    return rows


async def _search(auth_client, **params):
    resp = await auth_client.get(f"/api/base-studies/?{urlencode(params)}")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return [r["id"] for r in body["results"]], body["metadata"]["total_count"]


async def test_search_ranks_by_term_frequency(
    auth_client, search_corpus
):
    ids, total = await _search(auth_client, search="quokkaflux")
    expected = [search_corpus[k].id for k in ("title", "abstract", "single")]
    assert ids == expected
    assert total == 3


async def test_search_ascending_reverses_relevance(auth_client, search_corpus):
    ids, _ = await _search(auth_client, search="quokkaflux", desc="false")
    assert ids == [search_corpus[k].id for k in ("single", "abstract", "title")]


async def test_explicit_sort_overrides_relevance(auth_client, search_corpus):
    ids, _ = await _search(auth_client, search="quokkaflux", sort="name", desc="false")
    # lower(name): "another heading" < "plain heading" < "quokkaflux responses..."
    assert ids == [search_corpus[k].id for k in ("single", "abstract", "title")]


async def test_search_excludes_negated_term(auth_client, search_corpus):
    ids, total = await _search(auth_client, search="quokkaflux NOT plain")
    assert sorted(ids) == sorted(
        [search_corpus["title"].id, search_corpus["single"].id]
    )
    assert total == 2


async def test_all_digit_search_is_exact_pmid_not_text(auth_client, search_corpus):
    # "miss" cites 90000002 in its abstract, so a text match would return it too.
    ids, total = await _search(auth_client, search="90000002")
    assert ids == [search_corpus["abstract"].id]
    assert total == 1
    # exact: a prefix of a pmid matches nothing through `search`
    assert await _search(auth_client, search="9000000") == ([], 0)


@pytest.mark.parametrize(
    "param, value, expected",
    [
        ("name", "QUOKKAFLUX", ["title"]),
        ("description", "QUOKKAFLUX and", ["abstract"]),
        ("authors", "smith", ["single", "title"]),
        ("publication", "neuro letters", ["single", "abstract"]),
        ("doi", "quokka", ["abstract", "title"]),
        ("pmid", "9000000", ["miss", "single", "abstract", "title"]),
        ("pmid", "90000003", ["single"]),
    ],
)
async def test_field_filters_are_case_insensitive_substring(
    auth_client, search_corpus, param, value, expected
):
    ids, total = await _search(auth_client, **{param: value})
    # created_at ties inside one transaction, so only membership is stable
    assert sorted(ids) == sorted(search_corpus[k].id for k in expected)
    assert total == len(expected)


async def test_year_range_filters(auth_client, search_corpus):
    ids, total = await _search(auth_client, year_min=2015, year_max=2020)
    assert sorted(ids) == sorted(search_corpus[k].id for k in ("single", "abstract"))
    assert total == 2


async def test_search_combined_with_field_filters(auth_client, search_corpus):
    ids, total = await _search(
        auth_client,
        search="quokkaflux",
        authors="smith",
        year_min=2015,
    )
    assert ids == [search_corpus["single"].id]
    assert total == 1

    ids, total = await _search(auth_client, search="quokkaflux", publication="neuro")
    assert ids == [search_corpus[k].id for k in ("abstract", "single")]
    assert total == 2


async def test_search_paging_keeps_relevance_order_and_total(
    auth_client, search_corpus
):
    seen = []
    for page in (1, 2, 3, 4):
        ids, total = await _search(
            auth_client, search="quokkaflux", page_size=1, page=page
        )
        assert total == 3
        seen.extend(ids)
    assert seen == [search_corpus[k].id for k in ("title", "abstract", "single")]


async def test_search_without_pagination_returns_every_match(
    auth_client, search_corpus
):
    ids, total = await _search(auth_client, search="quokkaflux", paginate="false")
    assert ids == [search_corpus[k].id for k in ("title", "abstract", "single")]
    assert total == 3


async def test_search_on_view_without_full_text_vector(
    auth_client, ingest_neurosynth, session
):
    """Analyses have no full-text vector, so a text `search` is ignored."""
    everything = await auth_client.get("/api/analyses/")
    assert everything.status_code == 200
    total = everything.json()["metadata"]["total_count"]
    assert total > 0

    for query in ("zzzzqq", "-zzzzqq", "zzzzqq AND"):
        resp = await auth_client.get(f"/api/analyses/?{urlencode({'search': query})}")
        assert resp.status_code == 200
        assert resp.json()["metadata"]["total_count"] == total


async def test_all_digit_search_on_view_without_pmid_is_ignored(
    auth_client, ingest_neurosynth, session
):
    """Analyses have no pmid column, so an all-digits `search` has nothing to match."""
    everything = await auth_client.get("/api/analyses/")
    resp = await auth_client.get("/api/analyses/?search=12345")
    assert resp.status_code == 200
    assert (
        resp.json()["metadata"]["total_count"]
        == everything.json()["metadata"]["total_count"]
    )


async def test_annotations_search_param_does_not_error(
    auth_client, ingest_neurosynth, session
):
    """Annotations have no full-text vector, so `search` is ignored, like on analyses."""
    everything = await auth_client.get("/api/annotations/")
    assert everything.status_code == 200
    resp = await auth_client.get("/api/annotations/?search=abc")
    assert resp.status_code == 200
    assert (
        resp.json()["metadata"]["total_count"]
        == everything.json()["metadata"]["total_count"]
    )


@pytest.mark.parametrize("param", ["source=x", "source_id=1"])
async def test_base_studies_unknown_filter_does_not_error(
    param, auth_client, ingest_neurosynth, session
):
    """Base studies have no source columns; the parameters are not filters."""
    resp = await auth_client.get(f"/api/base-studies/?{param}")
    assert resp.status_code == 200


@pytest.mark.parametrize("resource", ["images", "points"])
async def test_filter_by_analysis_name(resource, auth_client, session):
    """The name is the analysis's own: the image or point is found through its analysis."""
    from neurostore.models import Image, Point, User

    user = User.query.filter_by(external_id=auth_client.username).first()

    def row(analysis_name):
        if resource == "images":
            return Analysis(
                name=analysis_name,
                user=user,
                images=[Image(filename=analysis_name, url="u", user=user)],
            )
        return Analysis(
            name=analysis_name,
            user=user,
            points=[Point(x=0, y=0, z=0, user=user)],
        )

    study = Study(
        name="s", user=user, analyses=[row("fear conditioning"), row("reward task")]
    )
    session.add(study)
    session.commit()
    by_name = {a.name: a.id for a in study.analyses}

    resp = await auth_client.get(f"/api/{resource}/?analysis_name=FEAR")
    assert resp.status_code == 200
    assert [r["analysis"] for r in resp.json()["results"]] == [
        by_name["fear conditioning"]
    ]


async def test_sort_by_an_unknown_field_is_refused(
    auth_client, ingest_neurosynth, session
):
    resp = await auth_client.get("/api/studies/?sort=nope")
    assert resp.status_code == 400
    assert "nope" in resp.json()["detail"]


async def test_unique_by_an_unknown_field_is_refused(
    auth_client, ingest_neurosynth, session
):
    resp = await auth_client.get("/api/studies/?unique=nope")
    assert resp.status_code == 400
    assert "nope" in resp.json()["detail"]


async def test_user_id_is_not_a_parameter_of_a_resource_without_owners(
    auth_client, session
):
    """Users have no user_id column, so the parameter is dropped like any unknown one."""
    resp = await auth_client.get("/api/users/?user_id=nobody")
    assert resp.status_code == 200
    assert resp.json()["metadata"]["total_count"] >= 1


def _list_endpoints():
    """Each list path in the spec: the query parameters it advertises and its view."""
    from importlib import import_module
    from pathlib import Path

    import yaml

    import neurostore
    from neurostore.resources import pipeline, users  # noqa: F401
    from neurostore.resources.base import ListView
    from neurostore.resources.data_views import DATA_VIEW_MODULES

    for module in DATA_VIEW_MODULES.values():
        import_module(module)

    spec = yaml.safe_load(
        (
            Path(neurostore.__file__).parent / "openapi" / "neurostore-openapi.yml"
        ).read_text()
    )
    components = spec["components"]["parameters"]
    views = {}
    pending = list(ListView.__subclasses__())
    while pending:
        view = pending.pop()
        pending.extend(view.__subclasses__())
        model = getattr(view, "_model", None)
        if model is not None:
            views[model.__tablename__.replace("_", "-")] = view

    endpoints = []
    for path, item in spec["paths"].items():
        name = path.strip("/")
        if "get" not in item or "/" in name or "{" in name or name == "review":
            continue
        advertised = {
            components[p["$ref"].rsplit("/", 1)[1]]["name"] if "$ref" in p else p["name"]
            for p in item["get"].get("parameters", [])
            if "in" not in p or p["in"] == "query"
        }
        endpoints.append((name, advertised, views.get(name)))
    return sorted(endpoints, key=lambda endpoint: endpoint[0])


@pytest.mark.parametrize("path,advertised,view", _list_endpoints())
async def test_no_list_query_parameter_is_a_server_error(
    path, advertised, view, auth_client, ingest_neurosynth, session
):
    """A query parameter is the caller's input: it is served or refused, never a 500."""
    declared = set(view()._user_args) if view else set()
    # semantic_search embeds the query through an external service
    params = (advertised | declared | {"search"}) - {"semantic_search"}
    errors = []
    for param in sorted(params):
        for value in ("a", "123"):
            resp = await auth_client.get(f"/api/{path}/?{urlencode({param: value})}")
            if resp.status_code >= 500:
                errors.append(f"{param}={value}: {resp.status_code}")
    assert not errors


@pytest.mark.parametrize("path,advertised,view", _list_endpoints())
def test_search_is_advertised_only_where_the_view_can_search(path, advertised, view):
    if view is None:
        pytest.skip("not a list view of a model")
    can_search = bool(view._multi_search) or (
        view().pmid_match(view._model, "1") is not None
    )
    assert ("search" in advertised) == can_search


@pytest.mark.parametrize(
    "path,field",
    [
        ("base-studies", "ace_fulltext"),
        ("base-studies", "pubget_fulltext"),
        ("base-studies", "_ts_vector"),
        ("base-studies", "metadata_"),
        ("studies", "metadata_"),
    ],
)
async def test_sort_by_a_large_or_internal_field_is_refused(
    path, field, auth_client, ingest_neurosynth, session
):
    resp = await auth_client.get(f"/api/{path}/?sort={field}")
    assert resp.status_code == 400
    assert field in resp.json()["detail"]
