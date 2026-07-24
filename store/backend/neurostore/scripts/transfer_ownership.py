from dataclasses import dataclass

from sqlalchemy import func, inspect, select, text, update

from neurostore.database import db
from neurostore.models.auth import User
from neurostore.models.data import (
    Analysis,
    Annotation,
    AnnotationAnalysis,
    BaseStudy,
    Condition,
    Image,
    Point,
    PointValue,
    Study,
    Studyset,
    Table,
)


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


EXTERNAL_ID_OWNED_MODELS = (
    Analysis,
    Annotation,
    AnnotationAnalysis,
    BaseStudy,
    Condition,
    Image,
    Point,
    PointValue,
    Study,
    Studyset,
    Table,
)

LEGACY_ID_OWNED_TABLES = ("metaanalyses",)


def get_external_id_owned_models() -> list[type[db.Model]]:
    """Return Store models whose user_id points at users.external_id."""
    return sorted(EXTERNAL_ID_OWNED_MODELS, key=lambda model: model.__tablename__)


def get_legacy_id_owned_tables(session) -> list[str]:
    """Return present legacy tables whose user_id points at users.id."""
    inspector = inspect(session.get_bind())
    return sorted(
        table_name
        for table_name in LEGACY_ID_OWNED_TABLES
        if inspector.has_table(table_name)
    )


def _require_user(session, external_id: str, label: str) -> User:
    user = session.execute(
        select(User).where(User.external_id == external_id)
    ).scalar_one_or_none()
    if user is None:
        raise OwnershipTransferError(
            f"{label} user with external_id={external_id!r} does not exist."
        )
    return user


def _validate_transfer(session, source_user_id: str, destination_user_id: str):
    if source_user_id == destination_user_id:
        raise OwnershipTransferError("source and destination users must be different.")

    source_user = _require_user(session, source_user_id, "source")
    destination_user = _require_user(session, destination_user_id, "destination")
    return source_user, destination_user


def _count_model_rows(session, model, user_id: str) -> int:
    return session.execute(
        select(func.count()).select_from(model).where(model.user_id == user_id)
    ).scalar_one()


def _count_legacy_table_rows(session, table_name: str, user_id: str) -> int:
    return session.execute(
        text(f'SELECT count(*) FROM "{table_name}" WHERE user_id = :user_id'),
        {"user_id": user_id},
    ).scalar_one()


def _update_legacy_table_rows(
    session, table_name: str, source_user_id: str, destination_user_id: str
) -> int:
    result = session.execute(
        text(
            f'UPDATE "{table_name}" '
            "SET user_id = :destination_user_id "
            "WHERE user_id = :source_user_id"
        ),
        {
            "source_user_id": source_user_id,
            "destination_user_id": destination_user_id,
        },
    )
    return result.rowcount or 0


def transfer_user_ownership(
    source_user_id: str,
    destination_user_id: str,
    *,
    dry_run: bool = True,
    session=None,
) -> OwnershipTransferSummary:
    """Transfer all Store rows owned by one user external_id to another.

    Most Store ownership columns reference ``users.external_id``. The legacy
    ``metaanalyses`` table references ``users.id`` and is transferred alongside
    the external-id tables after resolving both users.
    """
    sess = session or db.session
    transfer_started = False

    try:
        source_user, destination_user = _validate_transfer(
            sess, source_user_id, destination_user_id
        )

        counts: dict[str, int] = {}
        for model in get_external_id_owned_models():
            counts[model.__tablename__] = _count_model_rows(
                sess, model, source_user.external_id
            )

        for table_name in get_legacy_id_owned_tables(sess):
            counts[table_name] = _count_legacy_table_rows(
                sess, table_name, source_user.id
            )

        if dry_run:
            return OwnershipTransferSummary(
                source_user_id=source_user_id,
                destination_user_id=destination_user_id,
                counts=counts,
                dry_run=True,
            )

        updated_counts: dict[str, int] = {}
        transfer_started = True
        for model in get_external_id_owned_models():
            result = sess.execute(
                update(model)
                .where(model.user_id == source_user.external_id)
                .values(user_id=destination_user.external_id)
            )
            updated_counts[model.__tablename__] = result.rowcount or 0

        for table_name in get_legacy_id_owned_tables(sess):
            updated_counts[table_name] = _update_legacy_table_rows(
                sess,
                table_name,
                source_user.id,
                destination_user.id,
            )

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
