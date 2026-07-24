import pytest
from sqlalchemy import func, select

from neurosynth_compose.models.analysis import (
    Condition,
    MetaAnalysis,
    Project,
    SnapshotAnnotation,
    SnapshotStudyset,
    Specification,
    SpecificationCondition,
    Tag,
)
from neurosynth_compose.models.auth import User
from neurosynth_compose.scripts.transfer_ownership import (
    OwnershipTransferError,
    transfer_user_ownership,
)


def _add_user(session, external_id, name):
    user = User(external_id=external_id, name=name)
    session.add(user)
    session.flush()
    return user


def _count_owned(session, model, user_id):
    return session.execute(
        select(func.count()).select_from(model).where(model.user_id == user_id)
    ).scalar_one()


def _seed_source_owned_objects(session, user):
    specification = Specification(user=user, type="cbma")
    condition = Condition(name="condition")
    session.add_all([specification, condition])
    session.flush()

    session.add_all(
        [
            Tag(user=user, name="source-tag"),
            SpecificationCondition(
                user=user,
                specification=specification,
                condition=condition,
                weight=1.0,
            ),
            SnapshotStudyset(user=user, snapshot={"source": "studyset"}),
            SnapshotAnnotation(user=user, snapshot={"source": "annotation"}),
            MetaAnalysis(user=user, name="source meta", specification=specification),
            Project(user=user, name="source project"),
        ]
    )
    session.flush()


def test_transfer_user_ownership_dry_run_does_not_update(session):
    source = _add_user(session, "source-user-id", "source")
    destination = _add_user(session, "destination-user-id", "destination")
    _seed_source_owned_objects(session, source)

    summary = transfer_user_ownership(
        source.external_id,
        destination.external_id,
        dry_run=True,
        session=session,
    )

    assert summary.dry_run is True
    assert summary.counts["projects"] == 1
    assert summary.counts["tags"] == 1
    assert _count_owned(session, Project, source.external_id) == 1
    assert _count_owned(session, Project, destination.external_id) == 0


def test_transfer_user_ownership_moves_all_user_owned_rows(session):
    source = _add_user(session, "source-user-id", "source")
    destination = _add_user(session, "destination-user-id", "destination")
    session.add(Project(user=destination, name="existing destination project"))
    _seed_source_owned_objects(session, source)
    session.flush()

    summary = transfer_user_ownership(
        source.external_id,
        destination.external_id,
        dry_run=False,
        session=session,
    )

    assert summary.dry_run is False
    assert summary.counts["annotations"] == 1
    assert summary.counts["meta_analyses"] == 1
    assert summary.counts["projects"] == 1
    assert summary.counts["specification_conditions"] == 1
    assert summary.counts["specifications"] == 1
    assert summary.counts["studysets"] == 1
    assert summary.counts["tags"] == 1
    assert summary.total == 7

    for model in (
        MetaAnalysis,
        Project,
        SnapshotAnnotation,
        SnapshotStudyset,
        Specification,
        SpecificationCondition,
        Tag,
    ):
        assert _count_owned(session, model, source.external_id) == 0

    assert _count_owned(session, Project, destination.external_id) == 2
    assert _count_owned(session, Tag, destination.external_id) == 1


def test_transfer_user_ownership_rejects_destination_tag_collision(session):
    source = _add_user(session, "source-user-id", "source")
    destination = _add_user(session, "destination-user-id", "destination")
    session.add_all(
        [
            Tag(user=source, name="Shared Tag"),
            Tag(user=destination, name="shared tag"),
            Project(user=source, name="source project"),
        ]
    )
    session.flush()

    with pytest.raises(OwnershipTransferError, match="tag name uniqueness"):
        transfer_user_ownership(
            source.external_id,
            destination.external_id,
            dry_run=False,
            session=session,
        )

    assert _count_owned(session, Project, source.external_id) == 1
    assert _count_owned(session, Project, destination.external_id) == 0
