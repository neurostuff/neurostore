from types import SimpleNamespace

from neurosynth_compose.resources.data_views.meta_analyses_view import (
    serialize_meta_analyses,
    serialize_meta_analysis,
)
from neurosynth_compose.resources.data_views.projects_view import (
    serialize_project,
    serialize_projects,
)
from neurosynth_compose.schemas.analysis import MetaAnalysisSchema, ProjectSchema


def _build_project_namespace():
    user = SimpleNamespace(name="User", external_id="user-1")
    meta_analysis_user = SimpleNamespace(name="Meta Analyst", external_id="meta-user-1")
    neurostore_study = SimpleNamespace(
        created_at=None,
        updated_at=None,
        neurostore_id="study-1",
        exception=None,
        traceback=None,
        status="OK",
    )
    return SimpleNamespace(
        id="project-1",
        created_at=None,
        updated_at=None,
        user=user,
        user_id="user-1",
        name="project",
        description="description",
        provenance={
            "curationMetadata": {"columns": [{"id": "column-1", "stubStudies": []}]},
            "extractionMetadata": {
                "studyStatusList": [{"id": "study-1", "status": "TODO"}]
            },
            "metaAnalysisMetadata": {"canEditMetaAnalyses": True},
        },
        public=False,
        draft=True,
        studyset=SimpleNamespace(
            id="studyset-1", neurostore_id="neurostore-studyset-1"
        ),
        annotation=SimpleNamespace(
            id="annotation-1", neurostore_id="neurostore-annotation-1"
        ),
        meta_analyses=[
            SimpleNamespace(
                id="meta-1",
                name="meta",
                description="meta description",
                user=meta_analysis_user,
                user_id="meta-user-1",
            )
        ],
        neurostore_study=neurostore_study,
    )


def _build_meta_analysis_namespace():
    user = SimpleNamespace(name="Meta User", external_id="meta-user-1")
    spec_user = SimpleNamespace(name="Spec User", external_id="spec-user-1")
    studyset = SimpleNamespace(
        id="studyset-1",
        created_at=None,
        updated_at=None,
        user=user,
        user_id="meta-user-1",
        snapshot={"studies": []},
        neurostore_id="neurostore-studyset-1",
        neurostore_studyset=SimpleNamespace(id="neurostore-studyset-1"),
        version="v1",
    )
    annotation = SimpleNamespace(
        id="annotation-1",
        created_at=None,
        updated_at=None,
        user=user,
        user_id="meta-user-1",
        snapshot={"annotations": []},
        neurostore_id="neurostore-annotation-1",
        neurostore_annotation=SimpleNamespace(id="neurostore-annotation-1"),
        studyset=studyset,
    )
    specification_conditions = [
        SimpleNamespace(
            weight=1.0,
            condition=SimpleNamespace(name="condition-a"),
        )
    ]
    specification = SimpleNamespace(
        id="spec-1",
        created_at=None,
        updated_at=None,
        user=spec_user,
        user_id="spec-user-1",
        type="cbma",
        estimator={"type": "ALE"},
        filter="foo",
        database_studyset=None,
        corrector={"type": "FDRCorrector"},
        conditions=[SimpleNamespace(name="condition-a")],
        weights=[1.0],
        specification_conditions=specification_conditions,
    )
    return SimpleNamespace(
        id="meta-1",
        created_at=None,
        updated_at=None,
        user=user,
        user_id="meta-user-1",
        name="meta",
        description="meta description",
        public=False,
        provenance={"foo": "bar"},
        tags=[
            SimpleNamespace(
                id="tag-1",
                created_at=None,
                updated_at=None,
                name="tag-a",
                group="group-a",
                description="desc",
                official=True,
            )
        ],
        specification=specification,
        specification_id="spec-1",
        neurostore_analysis=SimpleNamespace(
            created_at=None,
            updated_at=None,
            neurostore_id="analysis-1",
            exception=None,
            traceback=None,
            status="OK",
        ),
        studyset=studyset,
        annotation=annotation,
        project_id="project-1",
        run_key="run-key-1",
        results=[
            SimpleNamespace(
                id="result-1",
                studyset_snapshot_id="studyset-1",
                annotation_snapshot_id="annotation-1",
            )
        ],
    )


def test_serialize_project_matches_project_schema_default():
    project = _build_project_namespace()

    expected = ProjectSchema(context={"info": False}).dump(project)
    actual = serialize_project(project, info=False)

    assert actual == expected


def test_serialize_project_matches_project_schema_info():
    project = _build_project_namespace()

    expected = ProjectSchema(context={"info": True}).dump(project)
    actual = serialize_project(project, info=True)

    assert actual == expected


def test_serialize_projects_matches_project_schema_many():
    projects = [_build_project_namespace(), _build_project_namespace()]

    expected = ProjectSchema(many=True, context={"info": True}).dump(projects)
    actual = serialize_projects(projects, info=True)

    assert actual == expected


def test_serialize_meta_analysis_matches_schema_default():
    meta_analysis = _build_meta_analysis_namespace()

    expected = MetaAnalysisSchema(context={"nested": False}).dump(meta_analysis)
    actual = serialize_meta_analysis(meta_analysis, nested=False)

    assert actual == expected


def test_serialize_meta_analysis_matches_schema_nested():
    meta_analysis = _build_meta_analysis_namespace()

    expected = MetaAnalysisSchema(context={"nested": True}).dump(meta_analysis)
    actual = serialize_meta_analysis(meta_analysis, nested=True)

    assert actual == expected


def test_serialize_meta_analyses_matches_schema_many():
    meta_analyses = [_build_meta_analysis_namespace(), _build_meta_analysis_namespace()]

    expected = MetaAnalysisSchema(many=True, context={"nested": False}).dump(
        meta_analyses
    )
    actual = serialize_meta_analyses(meta_analyses, nested=False)

    assert actual == expected
