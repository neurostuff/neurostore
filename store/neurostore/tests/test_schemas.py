import pytest

from ..schemas import StudySchema, StudysetSchema, StudysetSnapshot
from ..models import Study, Studyset

# Things I the schemas to do:
# 1. Cloning: I need a deep copy of the object, with new versions of all the sub-objects
#      a. cloning a study, create new everything
# 2. Cloning-lite: I need a shallow copy of the object (use existing references for sub-objects)
#      a. example: cloning a studyset, change ownership of studyset, but do not create new studies


def test_clone_study(ingest_neurosynth):
    study_entry = Study.query.first()

    shallow_clone = StudySchema(context={"clone": True}).dump(study_entry)

    assert "id" not in shallow_clone


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


@pytest.mark.skip(reason="website convenience parameters and exported object diverged")
def test_compare_dataset_with_snapshot(ingest_neurosynth):
    studyset = Studyset.query.first()
    marshmallow_ss = StudysetSchema(context={"nested": True, "copy": True}).dump(
        studyset
    )
    quick_ss = StudysetSnapshot().dump(studyset)

    assert marshmallow_ss == quick_ss
