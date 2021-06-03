from ..schemas import StudySchema
from ..models import Study


def test_StudySchema(auth_client, ingest_neurosynth):
    study_entry = Study.query.first()
    payload = auth_client.get(f"/api/studies/{study_entry.id}?nested=true").json
    payload.pop("created_at")
    payload.pop("user")
    payload["metadata"] = {"cool": "important detail"}
    [(pl.pop("created_at"), pl.pop("study")) for pl in payload["analysis"]]
    [
        (p.pop("created_at"), p.pop("analysis"))
        for pl in payload["analysis"]
        for p in pl["point"]
    ]
    StudySchema().load(payload)
    StudySchema().validate(payload)
