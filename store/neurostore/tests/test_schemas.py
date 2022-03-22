from ..schemas import StudySchema, DatasetSchema, StudysetSnapshot
from ..models import Study, Dataset


def test_StudySchema(auth_client, ingest_neurosynth):
    study_entry = Study.query.first()
    payload = StudySchema(context={'nested': False}).dump(study_entry)
    [payload.pop(f, None) for f in StudySchema().fields if StudySchema().fields[f].dump_only]
    StudySchema().load(payload)
    StudySchema().validate(payload)


def test_compare_dataset_with_snapshot(ingest_neurosynth):
    studyset = Dataset.query.first()
    marshmallow_ss = DatasetSchema(context={'nested': True}).dump(studyset)
    quick_ss = StudysetSnapshot().dump(studyset)

    assert marshmallow_ss == quick_ss
