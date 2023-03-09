import pytest

from ..schemas import StudySchema, StudysetSchema, StudysetSnapshot
from ..models import Study, Studyset


def test_StudySchema(auth_client, ingest_neurosynth):
    study_entry = Study.query.first()
    payload = StudySchema(context={"nested": False}).dump(study_entry)
    [
        payload.pop(f, None)
        for f in StudySchema().fields
        if StudySchema().fields[f].dump_only
    ]
    StudySchema().load(payload)
    StudySchema().validate(payload)


@pytest.mark.skip(reason="website convienence parameters and exported object diverged")
def test_compare_dataset_with_snapshot(ingest_neurosynth):
    studyset = Studyset.query.first()
    marshmallow_ss = StudysetSchema(context={"nested": True, "copy": True}).dump(
        studyset
    )
    quick_ss = StudysetSnapshot().dump(studyset)

    assert marshmallow_ss == quick_ss
