"""The analysis the front end's New entity makes beside the golden analysis is one the server
takes: create-analysis.json, which the front end writes, applied to the golden bundle."""

import json

import pytest

from neurostore.review.core.ops import (
    ReviewState,
    apply_batch,
    full_problems,
    incremental_problems,
)
from neurostore.tests.review import golden, records


@pytest.mark.parametrize(
    "validate", [incremental_problems, full_problems], ids=["incremental", "full"]
)
def test_the_front_ends_new_analysis_applies_to_the_golden_bundle(validate):
    bundle = json.loads(golden.BUNDLE.read_text("utf-8"))
    op = json.loads(golden.CREATE_ANALYSIS.read_text("utf-8"))
    review = bundle["review"]
    state = ReviewState(
        record=bundle["record"],
        coordinate_parse=bundle["coordinate_parse"],
        coordinate_revision=bundle["coordinate_revision"],
        provenance=review["provenance"],
        annotations=review["annotations"],
        last_seq=review["last_seq"],
    )
    after, _ = apply_batch(
        state, {"ops": [op]}, text=bundle["text"], user_id=review["user_id"], at=golden.AT,
        stable_ids=records.minting(), validate=validate,
    )
    assert len(after.record["analyses"]) == len(bundle["record"]["analyses"]) + 1
