"""Positions for stubs in a column, changing as few rows as possible.

A column's order is its stubs sorted by ``position`` (a float). Given the order
a save wants and the positions stubs have now, :func:`assign_positions` keeps
the longest run of stubs that are already in order and places every other stub
between its kept neighbours. Moving one stub, or adding stubs at the top of a
40k column, rewrites only the stubs that moved or are new.
"""

from __future__ import annotations

from bisect import bisect_left
from typing import Hashable, Mapping, Sequence

GAP = 1024.0
# Below this spacing floats lose distinct values; the column is renumbered.
MIN_GAP = 1e-6


def _longest_increasing(values: Sequence[float]) -> set[int]:
    """Indexes of one longest strictly increasing subsequence of ``values``."""
    tails: list[float] = []
    tail_index: list[int] = []
    previous = [-1] * len(values)
    for i, value in enumerate(values):
        j = bisect_left(tails, value)
        if j == len(tails):
            tails.append(value)
            tail_index.append(i)
        else:
            tails[j] = value
            tail_index[j] = i
        previous[i] = tail_index[j - 1] if j else -1
    kept = set()
    i = tail_index[-1] if tail_index else -1
    while i != -1:
        kept.add(i)
        i = previous[i]
    return kept


def assign_positions(
    order: Sequence[Hashable], current: Mapping[Hashable, float]
) -> dict[Hashable, float]:
    """Positions that make sorting by position give ``order``.

    Returns only the keys whose position must be set: keys absent from
    ``current``, and keys that are out of order. ``order`` must not repeat a key.
    """
    known = [i for i, key in enumerate(order) if key in current]
    kept = {known[i] for i in _longest_increasing([current[order[i]] for i in known])}

    result: dict[Hashable, float] = {}
    i = 0
    n = len(order)
    while i < n:
        if i in kept:
            i += 1
            continue
        start = i
        while i < n and i not in kept:
            i += 1
        run = order[start:i]
        low = current[order[start - 1]] if start > 0 else None
        high = current[order[i]] if i < n else None
        if low is None and high is None:
            values = [GAP * (k + 1) for k in range(len(run))]
        elif low is None:
            values = [high - GAP * (len(run) - k) for k in range(len(run))]
        elif high is None:
            values = [low + GAP * (k + 1) for k in range(len(run))]
        else:
            step = (high - low) / (len(run) + 1)
            if step < MIN_GAP:
                return renumber(order)
            values = [low + step * (k + 1) for k in range(len(run))]
        result.update(zip(run, values))
    return result


def renumber(order: Sequence[Hashable]) -> dict[Hashable, float]:
    """Evenly spaced positions for every key."""
    return {key: GAP * (i + 1) for i, key in enumerate(order)}
