from sqlalchemy import func, select

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
    StudysetStudy,
    Table,
)
from neurostore.scripts.transfer_ownership import transfer_user_ownership


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
    studyset = Studyset(name="source studyset", user=user)
    base_study = BaseStudy(name="source base study", user=user, level="group")
    study = Study(
        name="source study",
        user=user,
        level="group",
        base_study=base_study,
    )
    table = Table(study=study, t_id="1", name="source table", user=user)
    analysis = Analysis(name="source analysis", study=study, table=table, user=user)
    condition = Condition(name="source condition", user=user)
    point = Point(analysis=analysis, x=1.0, y=2.0, z=3.0, user=user)
    image = Image(analysis=analysis, study=study, url="https://example.com", user=user)
    annotation = Annotation(name="source annotation", studyset=studyset, user=user)
    studyset_study = StudysetStudy(study=study, studyset=studyset)

    session.add_all(
        [
            studyset,
            base_study,
            study,
            table,
            analysis,
            condition,
            point,
            image,
            annotation,
            studyset_study,
        ]
    )
    session.flush()

    annotation_analysis = AnnotationAnalysis(
        user=user,
        study_id=study.id,
        studyset_id=studyset.id,
        annotation_id=annotation.id,
        analysis_id=analysis.id,
    )
    point_value = PointValue(point=point, kind="z", value=1.23, user=user)
    session.add_all([annotation_analysis, point_value])
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
    assert summary.counts["studysets"] == 1
    assert _count_owned(session, Studyset, source.external_id) == 1
    assert _count_owned(session, Studyset, destination.external_id) == 0


def test_transfer_user_ownership_moves_store_rows(session):
    source = _add_user(session, "source-user-id", "source")
    destination = _add_user(session, "destination-user-id", "destination")
    session.add(Studyset(name="existing destination studyset", user=destination))
    _seed_source_owned_objects(session, source)
    session.flush()

    summary = transfer_user_ownership(
        source.external_id,
        destination.external_id,
        dry_run=False,
        session=session,
    )

    assert summary.dry_run is False
    assert summary.counts["analyses"] == 1
    assert summary.counts["annotation_analyses"] == 1
    assert summary.counts["annotations"] == 1
    assert summary.counts["base_studies"] == 1
    assert summary.counts["conditions"] == 1
    assert summary.counts["images"] == 1
    assert summary.counts["point_values"] == 1
    assert summary.counts["points"] == 1
    assert summary.counts["studies"] == 1
    assert summary.counts["studysets"] == 1
    assert summary.counts["tables"] == 1
    assert summary.total == 11

    for model in (
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
    ):
        assert _count_owned(session, model, source.external_id) == 0

    assert _count_owned(session, Studyset, destination.external_id) == 2
