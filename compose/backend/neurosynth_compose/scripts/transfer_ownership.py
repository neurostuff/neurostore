from dataclasses import dataclass
from sqlalchemy import func, select, update

from neurosynth_compose.database import db
from neurosynth_compose.models.analysis import (
    MetaAnalysis,
    Project,
    SnapshotAnnotation,
    SnapshotStudyset,
    Specification,
    SpecificationCondition,
    Tag,
)
from neurosynth_compose.models.auth import User


class OwnershipTransferError(ValueError):
    """Raised when an ownership transfer cannot be performed safely."""


@dataclass(frozen=True)
class OwnershipTransferSummary:
    source_user_id: str
    destination_user_id: str
    counts: dict[str, int]
    dry_run: bool

    @property
    def total(self) -> int:
        return sum(self.counts.values())


USER_OWNED_MODELS = (
    SnapshotAnnotation,
    MetaAnalysis,
    Project,
    SpecificationCondition,
    Specification,
    SnapshotStudyset,
    Tag,
)


def get_user_owned_models() -> list[type[db.Model]]:
    """Return user-owned models in deterministic update order."""
    return sorted(USER_OWNED_MODELS, key=lambda model: model.__tablename__)


def _require_user(session, external_id: str, label: str) -> User:
    user = session.execute(
        select(User).where(User.external_id == external_id)
    ).scalar_one_or_none()
    if user is None:
        raise OwnershipTransferError(
            f"{label} user with external_id={external_id!r} does not exist."
        )
    return user


def _find_tag_name_collisions(session, source_user_id: str, destination_user_id: str):
    source_tags = (
        select(func.lower(Tag.name).label("normalized_name"))
        .where(Tag.user_id == source_user_id)
        .subquery()
    )

    return (
        session.execute(
            select(Tag.name)
            .join(
                source_tags,
                func.lower(Tag.name) == source_tags.c.normalized_name,
            )
            .where(Tag.user_id == destination_user_id)
            .order_by(Tag.name)
        )
        .scalars()
        .all()
    )


def _validate_transfer(session, source_user_id: str, destination_user_id: str) -> None:
    if source_user_id == destination_user_id:
        raise OwnershipTransferError("source and destination users must be different.")

    _require_user(session, source_user_id, "source")
    _require_user(session, destination_user_id, "destination")

    tag_collisions = _find_tag_name_collisions(
        session, source_user_id, destination_user_id
    )
    if tag_collisions:
        collision_list = ", ".join(repr(name) for name in tag_collisions)
        raise OwnershipTransferError(
            "Transfer would violate destination user's tag name uniqueness for: "
            f"{collision_list}."
        )


def transfer_user_ownership(
    source_user_id: str,
    destination_user_id: str,
    *,
    dry_run: bool = True,
    session=None,
) -> OwnershipTransferSummary:
    """Transfer all rows owned by one user external_id to another.

    Only models with a ``user_id`` foreign key to ``users.external_id`` are moved.
    This intentionally leaves the source and destination ``users`` rows unchanged.
    """
    sess = session or db.session
    transfer_started = False

    try:
        _validate_transfer(sess, source_user_id, destination_user_id)

        counts: dict[str, int] = {}
        for model in get_user_owned_models():
            count = sess.execute(
                select(func.count())
                .select_from(model)
                .where(model.user_id == source_user_id)
            ).scalar_one()
            counts[model.__tablename__] = count

        if dry_run:
            return OwnershipTransferSummary(
                source_user_id=source_user_id,
                destination_user_id=destination_user_id,
                counts=counts,
                dry_run=True,
            )

        updated_counts: dict[str, int] = {}
        transfer_started = True
        for model in get_user_owned_models():
            result = sess.execute(
                update(model)
                .where(model.user_id == source_user_id)
                .values(user_id=destination_user_id)
            )
            updated_counts[model.__tablename__] = result.rowcount or 0

        sess.commit()
        return OwnershipTransferSummary(
            source_user_id=source_user_id,
            destination_user_id=destination_user_id,
            counts=updated_counts,
            dry_run=False,
        )
    except Exception:
        if transfer_started:
            sess.rollback()
        raise
