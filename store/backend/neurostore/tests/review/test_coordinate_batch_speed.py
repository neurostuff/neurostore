"""Batches on papers of the golden size and larger apply within their bounds (N4).

The timed tests run with ``python -m pytest --performance``.
"""

import copy
import json
import time

import pytest

from neurostore.review.core.ops import OpError, ReviewState, apply_batch
from neurostore.study_schema_tools import expected_key
from neurostore.tests.conftest import performance_test
from neurostore.tests.review import golden, records

ANALYSES, POINTS, RELABELS = 40, 220, 100
LARGE = (120, 1980)
AT = "2026-10-15T12:00:00Z"
BOUND_SECONDS = 2.0
#: The spans quoted on each extracted value of an Analysis entity: at the golden size they
#: make a record of the largest Astra paper's size, 0.93 MiB.
QUOTES = 64
#: Runs of a timed batch; the fastest is the one compared with its bound.
RUNS = 3


def _paper(analyses=ANALYSES, points=POINTS, quotes=0):
    """The golden text, and a parse grown to ``analyses`` analyses and ``points`` points, with
    a record holding one Analysis entity for each, each extracted value quoting ``quotes``
    spans."""
    bundle = json.loads(golden.BUNDLE.read_text("utf-8"))
    template = bundle["coordinate_parse"]["analyses"]
    pool = [point for analysis in template for point in analysis.get("points") or ()]
    made_analyses, taken = [], 0
    for i in range(analyses):
        base = copy.deepcopy(template[i % len(template)])
        count = points // analyses + (1 if i < points % analyses else 0)
        made_points = []
        for _ in range(count):
            point = copy.deepcopy(pool[taken % len(pool)])
            shift = taken // len(pool)
            point["coordinates"] = [v + shift for v in point["coordinates"]]
            made_points.append(point)
            taken += 1
        made = {**base, "name": f"{base['name']} [bench {i}]", "points": made_points}
        made.pop("name_is_printed", None)
        made.pop("key")
        made["key"] = expected_key({**made, "key": ""})
        made_analyses.append(made)
    parse = {**bundle["coordinate_parse"], "analyses": made_analyses}
    record = copy.deepcopy(bundle["record"])
    entity = copy.deepcopy(record["analyses"][0])
    for i, analysis in enumerate(made_analyses):
        item = {**copy.deepcopy(entity), "local_id": f"bench_an_{i}"}
        slot = {**entity["source_table_analysis"], "value": analysis["key"]}
        item["source_table_analysis"] = slot
        _quote(item, bundle["text"], quotes)
        record["analyses"].append(item)
    return bundle["text"], parse, record


def _quote(value, text, quotes):
    """Give each extracted value below ``value`` present evidence of ``quotes`` spans."""
    if isinstance(value, list):
        for item in value:
            _quote(item, text, quotes)
    if not isinstance(value, dict):
        return
    if quotes and value.get("extraction_status") == "extracted":
        span = {"start_char": 0, "end_char": 20, "text": text[:20]}
        value["evidence"] = {"status": "present", "sets": [
            {"source": "model_quote", "spans": [dict(span) for _ in range(quotes)]}
        ]}
    for item in value.values():
        _quote(item, text, quotes)


def _relabel(key, n):
    return {"client_op_id": f"relabel-{n:04d}", "type": "coordinate",
            "target": {"kind": "coordinate_analysis", "analysis_key": key}, "action": "relabel",
            "role": "result"}


def _set_name(local_id, n, value="renamed"):
    return {"client_op_id": f"set-name-{n:04d}", "type": "set_value",
            "target": {"kind": "slot", "entity": local_id, "path": "name"},
            "value": {"extraction_status": "extracted", "value": value}}


def _set_n(local_id, n, value):
    return {"client_op_id": f"set-n-{n:04d}", "type": "set_value",
            "target": {"kind": "slot", "entity": local_id, "path": "groups[group=grp_a].n"},
            "value": {"extraction_status": "extracted", "value": value}}


def _reviewed(analyses, points):
    """The text and a state of a paper of that size with a record of the largest Astra
    paper's density, its revision relabelling the first analysis."""
    text, parse, record = _paper(analyses, points, QUOTES)
    state = ReviewState(record=record, coordinate_parse=parse)
    state, _ = apply_batch(state, {"ops": [_relabel(parse["analyses"][0]["key"], 0)]},
                           text=text, user_id="u1", at=AT, stable_ids=records.minting())
    return text, state


def _fastest(state, ops, text):
    """The fastest of RUNS applications of ``ops`` to ``state``, in seconds, and what the last
    returned or raised."""
    times = []
    for _ in range(RUNS):
        started = time.perf_counter()
        try:
            outcome = apply_batch(state, {"ops": ops}, text=text, user_id="u1", at=AT,
                                  stable_ids=records.minting())
        except OpError as error:
            outcome = error
        times.append(time.perf_counter() - started)
    return min(times), outcome


@performance_test
def test_a_hundred_relabels_on_a_paper_of_the_golden_size_apply_within_two_seconds():
    text, parse, record = _paper()
    assert len(parse["analyses"]) == ANALYSES
    assert sum(len(a["points"]) for a in parse["analyses"]) == POINTS
    keys = [analysis["key"] for analysis in parse["analyses"]]
    batch = {"ops": [_relabel(keys[n % len(keys)], n) for n in range(RELABELS)]}
    state = ReviewState(record=record, coordinate_parse=parse)

    started = time.perf_counter()
    _, stored = apply_batch(state, batch, text=text, user_id="u1", at=AT,
                            stable_ids=records.minting())
    elapsed = time.perf_counter() - started

    assert len(stored) == RELABELS
    assert elapsed < BOUND_SECONDS, f"{RELABELS} relabels took {elapsed:.2f}s"


def test_the_quoted_record_of_the_golden_size_is_the_largest_astra_papers_size():
    _, _, record = _paper(quotes=QUOTES)
    assert 0.85 < len(json.dumps(record)) / 2**20 < 1.0


@performance_test
@pytest.mark.parametrize("size, bound", [((ANALYSES, POINTS), 0.3), (LARGE, 1.0)])
@pytest.mark.parametrize("kind", ["set_value", "coordinate"])
def test_one_op_on_a_large_paper_applies_within_its_bound(size, bound, kind):
    text, state = _reviewed(*size)
    second = state.coordinate_parse["analyses"][1]["key"]
    op = _set_name("bench_an_1", 1) if kind == "set_value" else _relabel(second, 1)

    elapsed, (_, stored) = _fastest(state, [op], text)

    assert len(stored) == 1
    assert elapsed < bound, f"one {kind} op at {size} took {elapsed:.2f}s"


def _hundred_ops_the_last_invalid():
    text, state = _reviewed(ANALYSES, POINTS)
    keys = [analysis["key"] for analysis in state.coordinate_parse["analyses"]]
    ops = [
        _relabel(keys[n % len(keys)], n) if n % 2 else _set_name(f"bench_an_{n % ANALYSES}", n)
        for n in range(RELABELS - 1)
    ]
    ops.append(_set_n("bench_an_0", RELABELS, "many"))
    return text, state, ops


def _assert_refused_at_the_last_op(refusal, record):
    at = next(i for i, a in enumerate(record["analyses"]) if a["local_id"] == "bench_an_0")
    assert isinstance(refusal, OpError)
    assert str(refusal) == f"op {RELABELS - 1} leaves an invalid document"
    assert refusal.problems[0].startswith(
        f"op {RELABELS - 1}: extraction-record /analyses/{at}/groups/0/n/value"
    )


def test_a_hundred_op_batch_whose_last_op_is_invalid_is_refused_naming_that_op_and_path():
    text, state, ops = _hundred_ops_the_last_invalid()

    with pytest.raises(OpError) as raised:
        apply_batch(state, {"ops": ops}, text=text, user_id="u1", at=AT,
                    stable_ids=records.minting())

    _assert_refused_at_the_last_op(raised.value, state.record)


@performance_test
def test_a_refused_hundred_op_batch_whose_last_op_is_invalid_is_refused_within_two_seconds():
    text, state, ops = _hundred_ops_the_last_invalid()

    elapsed, refusal = _fastest(state, ops, text)

    _assert_refused_at_the_last_op(refusal, state.record)
    assert elapsed < BOUND_SECONDS, f"the refused batch took {elapsed:.2f}s"
