import random
import string
from neurostore.models import Studyset, Study


def test_post_and_get_studysets(auth_client, ingest_neurosynth, session):
    # create a studyset
    payload = auth_client.get("/api/studies/").json()
    study_ids = [study["id"] for study in payload["results"]]
    post_data = {
        "name": "rock road",
        "description": "mah ice cram",
        "studies": study_ids,
    }
    post_resp = auth_client.post("/api/studysets/", data=post_data)
    assert post_resp.status_code == 200

    get_resp = auth_client.get(f"/api/studysets/{post_resp.json()['id']}")

    assert (
        set(get_resp.json()["studies"])
        == set(post_resp.json()["studies"])
        == set(study_ids)
    )


# @add_event_listeners
def test_add_many_studies_to_studyset(auth_client, ingest_neurosynth, session):
    existing_studies = Study.query.all()
    existing_study_ids = [s.id for s in existing_studies]

    # Function to generate a random DOI
    def generate_doi():
        doi = "10." + "".join(random.choices(string.digits, k=4)) + "/"
        doi += "".join(random.choices(string.ascii_lowercase, k=4)) + "."
        doi += "".join(random.choices(string.ascii_lowercase, k=4))
        return doi

    # List comprehension to generate the desired structure
    made_up_studies = [
        {
            "pmid": str(random.randint(100000, 999999)),
            "doi": generate_doi(),
            "name": "".join(random.choices(string.ascii_letters, k=10)),
        }
        for _ in range(100)
    ]
    # create empty studyset
    ss = auth_client.post("/api/studysets/", data={"name": "mixed_studyset"})

    assert ss.status_code == 200

    ss_id = ss.json()["id"]

    # combine made_up and created studies
    all_studies = existing_study_ids + made_up_studies

    ss_update = auth_client.put(
        f"/api/studysets/{ss_id}", data={"studies": all_studies}
    )

    assert ss_update.status_code == 200


def test_add_study_to_studyset(auth_client, ingest_neurosynth, session):
    payload = auth_client.get("/api/studies/").json()
    study_ids = [study["id"] for study in payload["results"]]
    post_data = {
        "name": "rock road",
        "description": "mah ice cram",
        "studies": study_ids[:-1],
    }
    post_resp = auth_client.post("/api/studysets/", data=post_data)
    assert post_resp.status_code == 200

    dset_id = post_resp.json()["id"]
    pre_nested = auth_client.get(f"/api/studysets/{dset_id}?nested=true")
    pre_non_nested = auth_client.get(f"/api/studysets/{dset_id}?nested=false")

    assert pre_nested.status_code == pre_non_nested.status_code == 200
    put_resp = auth_client.put(f"/api/studysets/{dset_id}", data={"studies": study_ids})

    assert put_resp.status_code == 200
    # test that the study shows up for both nested and not nested
    nested_resp = auth_client.get(f"/api/studysets/{dset_id}?nested=true")
    non_nested_resp = auth_client.get(f"/api/studysets/{dset_id}?nested=false")

    assert nested_resp.status_code == non_nested_resp.status_code == 200

    assert len(nested_resp.json()["studies"]) == len(non_nested_resp.json()["studies"])


def test_get_nested_nonnested_studysets(auth_client, ingest_neurosynth, session):
    studyset_id = Studyset.query.first().id
    non_nested = auth_client.get(f"/api/studysets/{studyset_id}?nested=false")
    nested = auth_client.get(f"/api/studysets/{studyset_id}?nested=true")

    assert isinstance(non_nested.json()["studies"][0], str)
    assert isinstance(nested.json()["studies"][0], dict)


def test_hot_swap_study_in_studyset(auth_client, ingest_neurosynth, session):
    # create studyset
    create_ss = auth_client.post("/api/studysets/", data={"name": "test"})

    assert create_ss.status_code == 200
    ss_test = create_ss.json()["id"]
    # cache studyset endpoint
    auth_client.get(f"/api/studysets/{ss_test}")
    auth_client.get(f"/api/studysets/{ss_test}?nested=false")
    auth_client.get(f"/api/studysets/{ss_test}?nested=true")
    # get study
    studies = Study.query.all()[0:2]
    study_ids = [s.id for s in studies]
    put_resp = auth_client.put(f"/api/studysets/{ss_test}", data={"studies": study_ids})
    assert put_resp.status_code == 200

    # test if cache is updated
    add_study = auth_client.get(f"/api/studysets/{ss_test}")
    add_study_non_nested = auth_client.get(f"/api/studysets/{ss_test}?nested=false")
    add_study_nested = auth_client.get(f"/api/studysets/{ss_test}?nested=true")

    assert (
        set(study_ids)
        == set([s for s in add_study.json()["studies"]])
        == set([s for s in add_study_non_nested.json()["studies"]])
        == set([s["id"] for s in add_study_nested.json()["studies"]])
    )

    # clone study
    clone_study = auth_client.post(f"/api/studies/?source_id={study_ids[0]}", data={})
    assert clone_study.status_code == 200

    clone_study_id = clone_study.json()["id"]
    new_study_ids = [clone_study_id, study_ids[1]]
    # swap out cloned study
    put_resp = auth_client.put(
        f"/api/studysets/{ss_test}", data={"studies": new_study_ids}
    )

    clone_ss = auth_client.get(f"/api/studysets/{ss_test}")
    clone_ss_nested = auth_client.get(f"/api/studysets/{ss_test}?nested=true")
    clone_ss_non_nested = auth_client.get(f"/api/studysets/{ss_test}?nested=false")

    assert (
        set(new_study_ids)
        == set(s for s in clone_ss.json()["studies"])
        == set(s for s in clone_ss_non_nested.json()["studies"])
        == set(s["id"] for s in clone_ss_nested.json()["studies"])
    )
