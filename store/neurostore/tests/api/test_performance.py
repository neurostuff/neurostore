from neurostore.tests.conftest import performance_test
from neurostore.models import Studyset, Study, Annotation
from neurostore.schemas import AnnotationSchema
from neurostore.resources import AnnotationsView
from time import time

import yappi
import contextlib


@contextlib.contextmanager
def profiled_yappi(output_file="yappi_profile.prof", sort_type="cumulative"):
    yappi.start()
    try:
        yield
    finally:
        yappi.stop()

        stats = yappi.get_func_stats()
        stats.sort("ttot")
        # You might want to include thread stats as well.
        # For that, you would use yappi.get_thread_stats()

        stats.save(output_file, type="pstat")

        # Clear stats after writing to file to avoid accumulating results across runs
        yappi.clear_stats()


@performance_test
def test_mass_deletion(assign_neurosynth_to_user, auth_client, session):
    studies = Study.query.all()
    start_time = time()
    for s in studies:
        resp = auth_client.delete(f"/api/studies/{s.id}")
        assert resp.status_code == 200
    end_time = time()
    total_time = end_time - start_time
    print("Total time to delete all studies: ", total_time)


@performance_test
def test_mass_creation(auth_client, session):
    start_time = time()
    with profiled_yappi("mass_creation.prof"):
        for i in range(1000):
            data = {
                "name": f"study{i}",
                "analyses": [
                    {
                        "name": f"analysis{i}",
                        "points": [{"x": 0, "y": 0, "z": 0, "space": "mni", "order": 1}],
                    }
                ],
            }
            resp = auth_client.post("/api/studies/", data=data)
            assert resp.status_code == 200
    end_time = time()
    total_time = end_time - start_time
    print("Total time to create 1000 studies: ", total_time)


@performance_test
def test_mass_cloning(auth_client, session):
    start_time = time()
    data = {
        "name": "study0",
        "analyses": [
            {
                "name": "analysis0",
                "points": [
                    {"x": 0, "y": 0, "z": 0, "space": "mni", "order": 0, "values": []}
                ],
                "order": 0,
            }
        ],
    }
    resp = auth_client.post("/api/studies/", data=data)
    source_id = resp.json()["id"]
    for i in range(500):
        resp = auth_client.post(
            f"/api/studies/?source_id={source_id}",
            data=data,
        )
        assert resp.status_code == 200
    end_time = time()
    total_time = end_time - start_time
    print("Total time to create 100 studies: ", total_time)

@performance_test
def test_get_large_annotation(assign_neurosynth_to_user, auth_client, session):
    annotation = Annotation.query.one()
    with profiled_yappi("annotation2.prof"):
        auth_client.get(f"/api/annotations/{annotation.id}")

@performance_test
def test_get_large_nested_studyset(ingest_neurosynth_enormous, auth_client, session):
    studyset = Studyset.query.one()
    with profiled_yappi("nested_studyset_large.prof"):
        auth_client.get(f"/api/studysets/{studyset.id}?nested=true")


@performance_test
def test_updating_annotation(assign_neurosynth_to_user, auth_client, session):
    q = Annotation.query
    q = AnnotationsView().eager_load(q)
    annotation = q.one()
    annotation_dict = AnnotationSchema().dump(annotation)
    with profiled_yappi("update_annotation_largs.prof"):
        for i in range(len(annotation_dict['notes'])):
            annotation_dict['notes'][i]['note']['_5'] = 1.0
            auth_client.put(f"/api/annotations/{annotation.id}", data=annotation_dict)
