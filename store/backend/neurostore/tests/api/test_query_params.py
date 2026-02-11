from urllib.parse import urlencode
import pytest
from ...models import Study, BaseStudy
from ...schemas.data import StudysetSchema, StudySchema, AnalysisSchema, StringOrNested
from ...services.has_media_flags import recompute_media_flags
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


@pytest.mark.parametrize("endpoint", ["studies", "base-studies"])
def test_map_type_filter(auth_client, session, endpoint):
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
        response = auth_client.post("/api/studies/", data=payload)
        assert response.status_code == 200
        created_study_ids.append(response.json()["id"])

    base_study_ids = {
        Study.query.filter_by(id=study_id).one().base_study_id
        for study_id in created_study_ids
    }
    recompute_media_flags(base_study_ids)
    session.commit()

    z_match = auth_client.get(f"/api/{endpoint}/?doi={z_doi}&map_type=z")
    z_miss = auth_client.get(f"/api/{endpoint}/?doi={t_doi}&map_type=z")
    t_match = auth_client.get(f"/api/{endpoint}/?doi={t_doi}&map_type=t")
    t_miss = auth_client.get(f"/api/{endpoint}/?doi={z_doi}&map_type=t")
    beta_var_match = auth_client.get(
        f"/api/{endpoint}/?doi={beta_var_doi}&map_type=beta_variance"
    )
    beta_var_miss = auth_client.get(
        f"/api/{endpoint}/?doi={z_doi}&map_type=beta_variance"
    )
    any_match = auth_client.get(f"/api/{endpoint}/?doi={any_doi}&map_type=any")
    any_match_z = auth_client.get(f"/api/{endpoint}/?doi={z_doi}&map_type=any")

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


def test_page_size(auth_client, ingest_neurosynth, session):
    num_studies = Study.query.count()
    results = []
    for i in range(1, num_studies + 1):
        get_page_size = auth_client.get(f"/api/studies/?page_size=1&page={i}")
        assert get_page_size.status_code == 200
        results.append(get_page_size.json()["results"][0]["id"])
    assert len(set(results)) == num_studies


def test_common_queries(auth_client, ingest_neurosynth, session):
    study = BaseStudy.query.filter(BaseStudy.pmid.isnot(None)).first()

    pmid_search = auth_client.get(f"/api/base-studies/?pmid={study.pmid}")

    total_search = auth_client.get(f"/api/base-studies/?search={study.pmid}")

    assert pmid_search.status_code == total_search.status_code == 200
    assert len(pmid_search.json()["results"]) == len(total_search.json()["results"])


def test_multiword_queries(auth_client, ingest_neurosynth, session):
    study = BaseStudy.query.first()
    name = study.name
    word_list = name.split(" ")
    single_word = word_list[-1]
    multiple_words = " ".join(word_list[-3:])

    single_word_search = auth_client.get(f"/api/base-studies/?search={single_word}")
    assert single_word_search.status_code == 200
    assert len(single_word_search.json()["results"]) > 0

    multi_word_search = auth_client.get(f"/api/base-studies/?search={multiple_words}")
    assert multi_word_search.status_code == 200
    assert len(multi_word_search.json()["results"]) > 0


@pytest.mark.parametrize("query, expected", valid_queries)
def test_valid_pubmed_queries(query, expected, auth_client, ingest_neurosynth, session):
    search = auth_client.get(f"/api/base-studies/?search={query}")
    assert search.status_code == 200


@pytest.mark.parametrize("query, expected", invalid_queries)
def test_invalid_pubmed_queries(
    query, expected, auth_client, ingest_neurosynth, session
):
    url_safe_query = urlencode({"search": query})
    search = auth_client.get(f"/api/base-studies/?{url_safe_query}")
    assert search.status_code == 400
