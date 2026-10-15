"""A batch of coordinate ops on a paper of the golden size applies within two seconds (N4)."""

import copy
import json
import time

from neurostore.review.ops import ReviewState, apply_batch
from neurostore.study_schema_tools import expected_key
from neurostore.tests.review import golden

ANALYSES, POINTS, ACCEPTS = 40, 220, 100
AT = "2026-10-15T12:00:00Z"
BOUND_SECONDS = 2.0


def _paper():
    """The golden text, and a parse grown to ANALYSES analyses and POINTS points, with a record
    holding one Analysis entity for each."""
    bundle = json.loads(golden.BUNDLE.read_text("utf-8"))
    template = bundle["coordinate_parse"]["analyses"]
    pool = [point for analysis in template for point in analysis.get("points") or ()]
    analyses, taken = [], 0
    for i in range(ANALYSES):
        base = copy.deepcopy(template[i % len(template)])
        count = POINTS // ANALYSES + (1 if i < POINTS % ANALYSES else 0)
        points = []
        for _ in range(count):
            point = copy.deepcopy(pool[taken % len(pool)])
            shift = taken // len(pool)
            point["coordinates"] = [v + shift for v in point["coordinates"]]
            points.append(point)
            taken += 1
        made = {**base, "name": f"{base['name']} [bench {i}]", "points": points}
        made.pop("name_is_printed", None)
        made.pop("key")
        made["key"] = expected_key({**made, "key": ""})
        analyses.append(made)
    parse = {**bundle["coordinate_parse"], "analyses": analyses}
    record = copy.deepcopy(bundle["record"])
    entity = copy.deepcopy(record["analyses"][0])
    for i, analysis in enumerate(analyses):
        item = {**copy.deepcopy(entity), "local_id": f"bench_an_{i}"}
        slot = {**entity["source_table_analysis"], "value": analysis["key"]}
        item["source_table_analysis"] = slot
        record["analyses"].append(item)
    return bundle["text"], parse, record


def _accept(key, n):
    return {"client_op_id": f"accept-{n:04d}", "type": "coordinate",
            "target": {"kind": "coordinate_analysis", "analysis_key": key}, "action": "accept"}


def test_a_hundred_accepts_on_a_paper_of_the_golden_size_apply_within_two_seconds():
    text, parse, record = _paper()
    assert len(parse["analyses"]) == ANALYSES
    assert sum(len(a["points"]) for a in parse["analyses"]) == POINTS
    keys = [analysis["key"] for analysis in parse["analyses"]]
    batch = {"ops": [_accept(keys[n % len(keys)], n) for n in range(ACCEPTS)]}
    state = ReviewState(record=record, coordinate_parse=parse)

    started = time.perf_counter()
    _, stored = apply_batch(state, batch, text=text, user_id="u1", at=AT)
    elapsed = time.perf_counter() - started

    assert len(stored) == ACCEPTS
    assert elapsed < BOUND_SECONDS, f"{ACCEPTS} accepts took {elapsed:.2f}s"
