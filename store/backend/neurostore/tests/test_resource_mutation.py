from types import SimpleNamespace

import pytest

from neurostore.exceptions.base import PermissionError
from neurostore.models import (
    Analysis,
    Annotation,
    AnnotationAnalysis,
    BaseStudy,
    Point,
    Study,
    Studyset,
    StudysetStudy,
    User,
)
from neurostore.resources.data import (
    AnalysesView,
    AnnotationsView,
    StudiesView,
    StudysetsView,
    TablesView,
)
from neurostore.resources.data_views.annotations_view import AnnotationMutationPolicy
from neurostore.tests.utils import ordered_note_keys


def _user(session, external_id):
    return session.query(User).filter_by(external_id=external_id).one()


def _study(session, user, *, name="Study", base_study=None, **kwargs):
    if base_study is None:
        base_study = BaseStudy(name=f"{name} Base", level="group", user=user)
        session.add(base_study)
        session.flush()

    study = Study(name=name, level="group", user=user, base_study=base_study, **kwargs)
    session.add(study)
    session.flush()
    return study


def _annotation_with_two_analyses(session, user):
    study = _study(session, user, name="Annotated Study")
    analysis_one = Analysis(name="Analysis 1", study=study, user=user, order=1)
    analysis_two = Analysis(name="Analysis 2", study=study, user=user, order=2)
    studyset = Studyset(name="Annotated Studyset", user=user)
    session.add_all([analysis_one, analysis_two, studyset])
    session.flush()

    studyset_study = StudysetStudy(study=study, studyset=studyset)
    annotation = Annotation(
        name="Annotation",
        studyset=studyset,
        user=user,
        note_keys=ordered_note_keys({"existing": "string"}),
    )
    session.add_all([studyset_study, annotation])
    session.flush()

    annotation_analyses = [
        AnnotationAnalysis(
            analysis=analysis_one,
            studyset_study=studyset_study,
            annotation=annotation,
            note={"existing": "A1"},
            user=user,
            study_id=analysis_one.study_id,
            studyset_id=studyset_study.studyset_id,
        ),
        AnnotationAnalysis(
            analysis=analysis_two,
            studyset_study=studyset_study,
            annotation=annotation,
            note={"existing": "A2"},
            user=user,
            study_id=analysis_two.study_id,
            studyset_id=studyset_study.studyset_id,
        ),
    ]
    with session.no_autoflush:
        annotation.annotation_analyses = annotation_analyses
        session.add_all(annotation_analyses)
    session.flush()
    return annotation


def test_analysis_mutation_duplicate_short_circuits_to_existing_record(
    session, mock_add_users
):
    user = _user(session, "user1-id")
    study = _study(session, user, name="Duplicate Study")
    analysis = Analysis(name="Shared Coordinates", study=study, user=user, order=1)
    session.add(analysis)
    session.flush()
    session.add_all(
        [
            Point(analysis=analysis, user=user, x=1, y=2, z=3, order=1),
            Point(analysis=analysis, user=user, x=4, y=5, z=6, order=2),
        ]
    )
    session.flush()

    payload = AnalysesView._schema().load(
        {
            "study": study.id,
            "name": "Shared Coordinates",
            "points": [
                {"coordinates": [4, 5, 6]},
                {"coordinates": [1, 2, 3]},
            ],
        },
        partial=True,
    )

    result = AnalysesView.update_or_create(payload, user=user, flush=False)

    assert result.id == analysis.id
    assert session.query(Analysis).count() == 1


def test_studyset_membership_only_mutation_reconciles_sorted_associations(
    session, mock_add_users, ingest_neurosynth
):
    user = _user(session, "user1-id")
    study_ids = [
        study_id
        for (study_id,) in session.query(Study.id).order_by(Study.id).limit(3).all()
    ]
    studyset = Studyset(name="Membership Only", user=user)
    session.add(studyset)
    session.flush()

    payload = StudysetsView._schema().load(
        {
            "studies": [
                study_ids[2],
                {"id": study_ids[1], "curation_stub_uuid": "stub-2"},
                study_ids[0],
            ]
        },
        partial=True,
    )

    result = StudysetsView.update_or_create(
        payload,
        id=studyset.id,
        user=user,
        record=studyset,
    )
    session.flush()

    persisted = session.query(StudysetStudy).filter_by(studyset_id=studyset.id).all()

    assert {assoc.study_id for assoc in persisted} == set(study_ids)
    assert {assoc.study_id: assoc.curation_stub_uuid for assoc in persisted}[
        study_ids[1]
    ] == "stub-2"
    assert [
        assoc["id"]
        for assoc in StudysetsView._schema().dump(result)["studyset_studies"]
    ] == sorted(study_ids)


def test_annotation_mutation_policy_fast_note_update_updates_existing_rows(
    session, mock_add_users
):
    user = _user(session, "user1-id")
    annotation = _annotation_with_two_analyses(session, user)
    policy = AnnotationMutationPolicy(
        SimpleNamespace(resource_cls=AnnotationsView, current_user=user)
    )
    payload = {
        "note_keys": ordered_note_keys({"existing": "string", "included": "boolean"}),
        "annotation_analyses": [
            {
                "id": annotation.annotation_analyses[0].id,
                "note": {"existing": "updated-1", "included": True},
            },
            {
                "id": annotation.annotation_analyses[1].id,
                "note": {"existing": "updated-2", "included": False},
            },
        ],
    }

    assert policy.is_fast_note_update_candidate(payload) is True
    assert policy.try_fast_note_update(annotation, payload) is True

    session.flush()
    assert annotation.note_keys["included"]["type"] == "boolean"
    assert [aa.note for aa in annotation.annotation_analyses] == [
        {"existing": "updated-1", "included": True},
        {"existing": "updated-2", "included": False},
    ]


def test_annotation_mutation_policy_attaches_preloaded_nested_records_for_fallback(
    session, mock_add_users
):
    user = _user(session, "user1-id")
    annotation = _annotation_with_two_analyses(session, user)
    policy = AnnotationMutationPolicy(
        SimpleNamespace(resource_cls=AnnotationsView, current_user=user)
    )
    first_note = annotation.annotation_analyses[0]
    payload = {
        "annotation_analyses": [
            {
                "id": first_note.id,
                "analysis": {"id": first_note.analysis_id},
                "studyset_study": {
                    "study": {"id": first_note.study_id},
                    "studyset": {"id": first_note.studyset_id},
                },
            }
        ]
    }

    policy.attach_existing_nested_records(annotation, payload)

    note_payload = payload["annotation_analyses"][0]
    assert note_payload["analysis"]["preloaded_data"].id == first_note.analysis_id
    assert (
        note_payload["studyset_study"]["preloaded_data"].study_id == first_note.study_id
    )
    assert (
        payload["_preloaded_nested_records"]["annotation_analyses"][first_note.id].id
        == first_note.id
    )


def test_annotation_mutation_policy_bulk_note_update_updates_rows(
    session, mock_add_users
):
    user = _user(session, "user1-id")
    annotation = _annotation_with_two_analyses(session, user)
    policy = AnnotationMutationPolicy(
        SimpleNamespace(resource_cls=AnnotationsView, current_user=user)
    )
    payload = {
        "name": "Bulk-updated annotation",
        "studyset": {"id": annotation.studyset_id},
        "note_keys": ordered_note_keys({"existing": "string", "included": "boolean"}),
        "annotation_analyses": [
            {
                "id": annotation.annotation_analyses[0].id,
                "analysis": {"id": annotation.annotation_analyses[0].analysis_id},
                "studyset_study": {
                    "study": {"id": annotation.annotation_analyses[0].study_id},
                    "studyset": {"id": annotation.annotation_analyses[0].studyset_id},
                },
                "note": {"existing": "bulk-1", "included": True},
            },
            {
                "id": annotation.annotation_analyses[1].id,
                "analysis": {"id": annotation.annotation_analyses[1].analysis_id},
                "studyset_study": {
                    "study": {"id": annotation.annotation_analyses[1].study_id},
                    "studyset": {"id": annotation.annotation_analyses[1].studyset_id},
                },
                "note": {"existing": "bulk-2", "included": False},
            },
        ],
    }

    assert policy.is_bulk_note_update_candidate(payload) is True
    assert policy.try_bulk_note_update(annotation, payload) is True

    session.flush()
    session.expire(annotation, ["annotation_analyses"])
    refreshed = session.query(Annotation).filter_by(id=annotation.id).one()
    assert refreshed.name == "Bulk-updated annotation"
    assert refreshed.note_keys["included"]["type"] == "boolean"
    notes_by_id = {aa.id: aa.note for aa in refreshed.annotation_analyses}
    assert notes_by_id[annotation.annotation_analyses[0].id] == {
        "existing": "bulk-1",
        "included": True,
    }
    assert notes_by_id[annotation.annotation_analyses[1].id] == {
        "existing": "bulk-2",
        "included": False,
    }


def test_studyset_bulk_link_only_payload_creates_associations_with_name(
    session, mock_add_users, ingest_neurosynth
):
    user = _user(session, "user1-id")
    study_ids = [
        study_id
        for (study_id,) in session.query(Study.id).order_by(Study.id).limit(3).all()
    ]
    payload = StudysetsView._schema().load(
        {
            "name": "Bulk-linked studyset",
            "studies": [{"id": study_id} for study_id in reversed(study_ids)],
        },
        partial=True,
    )

    result = StudysetsView.update_or_create(payload, user=user)
    session.flush()

    persisted = (
        session.query(StudysetStudy)
        .filter_by(studyset_id=result.id)
        .order_by(StudysetStudy.study_id)
        .all()
    )

    assert result.name == "Bulk-linked studyset"
    assert {assoc.study_id for assoc in persisted} == set(study_ids)


def test_study_mutation_policy_allows_foreign_base_study_link_and_clears_broken_source(
    session, mock_add_users
):
    owner = _user(session, "user1-id")
    foreign_user = _user(session, "user2-id")
    foreign_base_study = BaseStudy(
        name="Foreign Base Study", level="group", user=foreign_user
    )
    session.add(foreign_base_study)
    session.flush()

    study = StudiesView.update_or_create(
        {
            "name": "Linked Study",
            "level": "group",
            "source": "neurostore",
            "source_id": "missing-parent",
            "base_study": {"id": foreign_base_study.id},
        },
        user=owner,
        flush=False,
    )

    assert study.base_study == foreign_base_study
    assert study.source_id is None


def test_study_mutation_policy_creates_base_study_from_identifiers(
    session, mock_add_users
):
    user = _user(session, "user1-id")

    study = StudiesView.update_or_create(
        {
            "name": "Identifier Study",
            "level": "group",
            "doi": "10.1000/resource-mutation",
            "pmid": "123456",
            "description": "created through mutation policy",
        },
        user=user,
        flush=False,
    )

    assert study.base_study is not None
    assert study.base_study.doi == "10.1000/resource-mutation"
    assert study.base_study.pmid == "123456"


def test_default_parent_permission_still_blocks_foreign_parent_links(
    session, mock_add_users
):
    user = _user(session, "user1-id")
    foreign_user = _user(session, "user2-id")
    foreign_study = _study(session, foreign_user, name="Foreign Study")

    with pytest.raises(PermissionError):
        TablesView.update_or_create(
            {
                "name": "Blocked Table",
                "t_id": "table-1",
                "study": {"id": foreign_study.id},
            },
            user=user,
            flush=False,
        )
