import pytest
from ...models import Study
from ...schemas.data import StudysetSchema, StudySchema, AnalysisSchema, StringOrNested
from ..conftest import valid_queries, invalid_queries


@pytest.mark.parametrize("nested", ["true", "false"])
@pytest.mark.parametrize(
    "resource_schema",
    [
        ("studysets", StudysetSchema()),
        ("studies", StudySchema()),
        ("analyses", AnalysisSchema()),
    ],
)
def test_nested(auth_client, ingest_neurosynth, nested, resource_schema, session):
    resource, schema = resource_schema
    resp = auth_client.get(f"/api/{resource}/?nested={nested}")
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


def test_user_id(auth_client, user_data, session):
    from ...resources.users import User

    id_ = auth_client.username
    user = User.query.filter_by(external_id=id_).first()
    resp = auth_client.get(f"/api/studies/?user_id={user.external_id}")
    for study in resp.json()["results"]:
        assert study["user"] == user.external_id


def test_source_id(auth_client, ingest_neurosynth, session):
    from ...resources.data import Study

    study = Study.query.first()
    post = auth_client.post(f"/api/studies/?source_id={study.id}", data={})
    get = auth_client.get(f"/api/studies/?source_id={study.id}&nested=true")

    assert post.json() == get.json()["results"][0]


@pytest.mark.parametrize("endpoint", ["studies", "base-studies"])
def test_data_type(
    auth_client, ingest_neurosynth, ingest_neurovault, session, endpoint
):
    get_coord = auth_client.get(f"/api/{endpoint}/?data_type=coordinate")
    assert get_coord.status_code == 200
    get_img = auth_client.get(f"/api/{endpoint}/?data_type=image")
    assert get_img.status_code == 200
    get_both = auth_client.get(f"/api/{endpoint}/?data_type=both")
    assert get_both.status_code == 200
    assert (
        len(get_coord.json()["results"]) + len(get_img.json()["results"])
        == len(get_both.json()["results"])
        != 0
    )


def test_page_size(auth_client, ingest_neurosynth, session):
    num_studies = Study.query.count()
    results = []
    for i in range(1, num_studies + 1):
        get_page_size = auth_client.get(f"/api/studies/?page_size=1&page={i}")
        assert get_page_size.status_code == 200
        results.append(get_page_size.json()["results"][0]["id"])
    assert len(set(results)) == num_studies


def test_common_queries(auth_client, ingest_neurosynth, session):
    study = Study.query.filter(Study.pmid.isnot(None)).first()

    pmid_search = auth_client.get(f"/api/studies/?pmid={study.pmid}")

    total_search = auth_client.get(f"/api/studies/?search={study.pmid}")

    assert pmid_search.status_code == total_search.status_code == 200
    assert len(pmid_search.json()["results"]) == len(total_search.json()["results"])


def test_multiword_queries(auth_client, ingest_neurosynth, session):
    study = Study.query.first()
    name = study.name
    word_list = name.split(" ")
    single_word = word_list[-1]
    multiple_words = " ".join(word_list[-3:])

    single_word_search = auth_client.get(f"/api/studies/?search={single_word}")
    assert single_word_search.status_code == 200

    multi_word_search = auth_client.get(f"/api/studies/?search={multiple_words}")
    assert multi_word_search.status_code == 200


@pytest.mark.parametrize("query, expected", valid_queries)
def test_valid_pubmed_queries(query, expected, auth_client, ingest_neurosynth, session):
    search = auth_client.get(f"/api/studies/?search={query}")
    assert search.status_code == 200


@pytest.mark.parametrize("query, expected", invalid_queries)
def test_invalid_pubmed_queries(
    query, expected, auth_client, ingest_neurosynth, session
):
    search = auth_client.get(f"/api/studies/?search={query}")
    assert search.status_code == 400
