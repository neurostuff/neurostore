from ..schemas import StudySchema
from ..models import Study


def test_StudySchema(auth_client, ingest_neurosynth):
    study_entry = Study.query.first()
    payload = StudySchema(context={'nested': False}).dump(study_entry)
    [payload.pop(f, None) for f in StudySchema().fields if StudySchema().fields[f].dump_only]
    StudySchema().load(payload)
    StudySchema().validate(payload)
