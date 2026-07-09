import hashlib
import json

from neurosynth_compose.utils.snapshots import canonicalize_json, md5_of_snapshot


def test_canonicalize_same_for_different_key_order():
    a = {"b": [2, 1], "a": {"x": 1}}
    b = {"a": {"x": 1}, "b": [2, 1]}

    s1 = canonicalize_json(a)
    s2 = canonicalize_json(b)

    assert isinstance(s1, str)
    assert s1 == s2


def test_md5_matches_canonical_serialization():
    obj = {"unicode": "ümlaut", "num": 1.0}
    canonical = json.dumps(
        obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )
    expected = hashlib.md5(canonical.encode("utf-8")).hexdigest()

    got = md5_of_snapshot(obj)
    assert isinstance(got, str)
    assert got == expected
