import pytest

from neurosynth_compose.models import MetaAnalysis, Project


@pytest.mark.parametrize(
    "endpoint,model",
    [
        ("meta-analyses", MetaAnalysis),
        ("projects", Project),
    ],
)
def test_page_and_page_size(session, app, auth_client, user_data, db, endpoint, model):
    first_page = auth_client.get(f"/api/{endpoint}?page=1&page_size=100")
    assert first_page.status_code == 200
    object_ids = set([m["id"] for m in first_page.json["results"]])
    total_count = first_page.json["metadata"]["total_count"]
    returned_ids = []
    for num in range(1, total_count + 1):
        page = auth_client.get(f"/api/{endpoint}?page={num}&page_size=1")
        assert page.status_code == 200
        assert len(page.json["results"]) == 1
        returned_ids.append(page.json["results"][0]["id"])

    assert object_ids == set(returned_ids)


@pytest.mark.parametrize(
    "endpoint",
    [
        "meta-analyses",
        "projects",
    ],
)
@pytest.mark.parametrize(
    "sort_col",
    [
        "created_at",
        "updated_at",
        "name",
        "description",
    ],
)
def test_desc_and_sort_col(session, app, auth_client, user_data, endpoint, sort_col):
    descend = auth_client.get(f"/api/{endpoint}?desc=true&sort={sort_col}")
    ascend = auth_client.get(f"/api/{endpoint}?desc=false&sort={sort_col}")
    assert descend.status_code == ascend.status_code == 200

    descend_ids = [o["id"] for o in descend.json["results"]]
    ascend_ids = [o["id"] for o in ascend.json["results"]]

    ascend_ids.reverse()
    assert descend_ids == ascend_ids


@pytest.mark.parametrize(
    "endpoint,search_term",
    [
        ("meta-analyses", "meta analysis"),
        ("projects", "project"),
    ],
)
def test_search_name_description(
    session, app, auth_client, user_data, endpoint, search_term
):
    search = auth_client.get(f"/api/{endpoint}?search={search_term}")
    name = auth_client.get(f"/api/{endpoint}?name={search_term}")
    description = auth_client.get(f"/api/{endpoint}?description={search_term}")

    assert search.status_code == name.status_code == description.status_code == 200
    assert len(search.json["results"]) > 0
    assert (
        len(search.json["results"])
        == len(name.json["results"])
        == len(description.json["results"])
    )
