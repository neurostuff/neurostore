"""The stable_ids a batch's ops give entities: minted for a new entity, put back only when the
review has held them, and never a slot an op edits."""

from collections.abc import Callable
from dataclasses import dataclass

from neurostore.review.errors import ReviewError


@dataclass(frozen=True)
class StableIds:
    """The stable_ids of a batch's new entities: ``mint()`` gives one, and ``restorable`` holds
    those an op may put back, the ids the review's entities have held."""

    mint: Callable[[], str]
    restorable: frozenset = frozenset()


class Guard:
    """The stable_ids one pass over a batch's ops gives: ``known_ids``, those it may put back,
    gains each it mints."""

    def __init__(self, mint, known_ids):
        self._mint = mint
        self.known_ids = set(known_ids)

    def mint(self):
        minted = self._mint()
        self.known_ids.add(minted)
        return minted

    def give(self, local_ids, index):
        """Mint a stable_id for each entity of ``local_ids`` in ``index`` that carries none, and
        check the one each other carries."""
        current = _holders(index, local_ids)
        for local_id in local_ids:
            item = index[local_id].item
            if item.get("stable_id") is None:
                item["stable_id"] = self.mint()
            else:
                self._check_carried(item["stable_id"], current)
            current[item["stable_id"]] = local_id

    def check_restored(self, local_ids, index):
        """Check the stable_id each restored entity of ``local_ids`` in ``index`` carries."""
        current = _holders(index, local_ids)
        for local_id in local_ids:
            carried = index[local_id].item.get("stable_id")
            if carried is not None:
                self._check_carried(carried, current)
                current[carried] = local_id

    def _check_carried(self, carried, current):
        """Raise unless ``carried`` is one the review has held and is not in ``current``, the
        holder of each stable_id the record's other entities carry."""
        if carried in current:
            raise ReviewError(f"stable_id {carried} is {current[carried]}'s")
        if carried not in self.known_ids:
            raise ReviewError(
                f"stable_id {carried} is not one of the review's; "
                "the server gives a new entity its stable_id"
            )


def refuse_slot(target):
    if target["path"] == "stable_id":
        raise ReviewError("stable_id is the entity's id, not a slot a review edits")


def _holders(index, excluded):
    """stable_id -> local_id of each entity of ``index`` not in ``excluded`` that carries one."""
    return {
        entity.item["stable_id"]: local_id
        for local_id, entity in index.items()
        if local_id not in excluded and entity.item.get("stable_id")
    }
