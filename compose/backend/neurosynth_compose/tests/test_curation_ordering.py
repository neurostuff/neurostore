import random

from neurosynth_compose.curation.ordering import GAP, assign_positions


def _apply(order, current):
    positions = {**current, **assign_positions(order, current)}
    return sorted(order, key=positions.__getitem__), assign_positions(order, current)


def test_new_keys_fill_an_empty_column():
    order, changed = _apply(["a", "b", "c"], {})
    assert order == ["a", "b", "c"] and len(changed) == 3


def test_moving_one_stub_rewrites_only_that_stub():
    current = {k: GAP * (i + 1) for i, k in enumerate("abcdefgh")}
    order = list("abcdefgh")
    order.insert(1, order.pop(6))  # g up to second place

    result, changed = _apply(order, current)

    assert result == order
    assert list(changed) == ["g"]


def test_prepending_many_new_stubs_keeps_the_old_ones():
    current = {f"s{i}": GAP * (i + 1) for i in range(40000)}
    order = [f"n{i}" for i in range(1000)] + list(current)

    result, changed = _apply(order, current)

    assert result == order
    assert set(changed) == {f"n{i}" for i in range(1000)}


def test_a_full_gap_renumbers_the_column():
    current = {"a": 1.0, "b": 1.0 + 1e-7}
    order = ["a", "x", "b"]

    result, changed = _apply(order, current)

    assert result == order
    assert set(changed) == {"a", "x", "b"}


def test_random_orders_always_sort_back():
    rng = random.Random(7)
    for _ in range(200):
        keys = [f"k{i}" for i in range(rng.randint(0, 30))]
        current = {k: rng.uniform(0, 100) for k in keys if rng.random() < 0.7}
        order = keys + [f"new{i}" for i in range(rng.randint(0, 5))]
        rng.shuffle(order)
        result, _ = _apply(order, current)
        assert result == order
