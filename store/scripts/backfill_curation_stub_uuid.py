"""
Backfill `curation_stub_uuid` on studyset_studies from a supplied mapping file.

Usage:
    python backfill_curation_stub_uuid.py mapping.json

Expected JSON structure (list or dict of mappings):
[
  {"studyset_id": "abc", "study_id": "def", "curation_stub_uuid": "stub-uuid"},
  ...
]
"""

import json
import sys
from typing import Iterable, Mapping

from neurostore.database import db
from neurostore.models import StudysetStudy


def iter_mappings(data) -> Iterable[Mapping[str, str]]:
    if isinstance(data, dict):
        # allow a dict keyed by stub or any other key
        yield from data.values()
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                yield item


def main(path: str):
    with open(path, "r") as f:
        payload = json.load(f)

    updated = 0
    missing = 0

    for entry in iter_mappings(payload):
        studyset_id = entry.get("studyset_id")
        study_id = entry.get("study_id")
        stub = entry.get("curation_stub_uuid")
        if not (studyset_id and study_id and stub):
            missing += 1
            continue

        sss = (
            StudysetStudy.query.filter_by(
                studyset_id=studyset_id,
                study_id=study_id,
            ).first()
        )
        if not sss:
            missing += 1
            continue

        sss.curation_stub_uuid = stub
        updated += 1

    db.session.commit()
    print(f"Updated {updated} studyset-studies; {missing} entries had no matching row.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python backfill_curation_stub_uuid.py mapping.json")
        sys.exit(1)
    main(sys.argv[1])
