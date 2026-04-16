from __future__ import annotations

from copy import deepcopy
from urllib.parse import urlencode

from flask import abort, current_app, request
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from neurosynth_compose.database import commit_session, db
from neurosynth_compose.models.analysis import (
    NeurostoreAnnotation,
    MetaAnalysis,
    NeurostoreStudy,
    Project,
    Specification,
    SpecificationCondition,
    NeurostoreStudyset,
)
from neurosynth_compose.resources.common import create_user, get_current_user
from neurosynth_compose.resources.neurostore import neurostore_session
from neurosynth_compose.resources.resource_services import (
    create_or_update_neurostore_study,
)


class ProjectCloneService:
    def ensure_current_user(self):
        current_user = get_current_user()
        if current_user:
            return current_user
        current_user = create_user()
        if current_user:
            db.session.add(current_user)
            commit_session()
            return current_user
        raise abort(401, description="user authentication required")

    def clone(self, source_id, *, copy_annotations):
        current_user = self.ensure_current_user()
        source_project = db.session.execute(
            select(Project)
            .options(
                selectinload(Project.meta_analyses).options(
                    selectinload(MetaAnalysis.specification).options(
                        selectinload(Specification.specification_conditions)
                    ),
                    selectinload(MetaAnalysis.results),
                ),
            )
            .where(Project.id == source_id)
        ).scalar_one_or_none()

        if source_project is None:
            abort(404)
        if (
            not source_project.public
            and source_project.user_id != current_user.external_id
        ):
            abort(403, description="project is not public")

        access_token = request.headers.get("Authorization")
        if not access_token:
            from auth0.authentication.get_token import GetToken

            domain = current_app.config["AUTH0_BASE_URL"].lstrip("https://")
            g_token = GetToken(
                domain,
                current_app.config["AUTH0_CLIENT_ID"],
                client_secret=current_app.config["AUTH0_CLIENT_SECRET"],
            )
            token_resp = g_token.client_credentials(
                audience=current_app.config["AUTH0_API_AUDIENCE"],
            )
            access_token = " ".join(
                [token_resp["token_type"], token_resp["access_token"]]
            )

        ns_session = neurostore_session(access_token)
        with db.session.no_autoflush:
            new_ss_ref_id, new_ann_ref_id = self._clone_references(
                ns_session,
                source_project,
                copy_annotations,
            )
            cloned_project = Project(
                name=source_project.name + " Copy",
                description=source_project.description,
                provenance=self._clone_provenance(
                    source_project.provenance,
                    new_ss_ref_id,
                    new_ann_ref_id,
                ),
                user=current_user,
                public=False,
                draft=True,
                neurostore_studyset_id=new_ss_ref_id,
                neurostore_annotation_id=new_ann_ref_id,
            )

            cloned_metas = [
                self._clone_meta_analysis(
                    meta,
                    current_user,
                    cloned_project,
                    new_ss_ref_id,
                    new_ann_ref_id,
                )
                for meta in source_project.meta_analyses
            ]
            cloned_project.meta_analyses = cloned_metas
            db.session.add(cloned_project)
            for meta in cloned_metas:
                db.session.add(meta)
            commit_session()

            ns_study = NeurostoreStudy(project=cloned_project)
            db.session.add(ns_study)
            commit_session()
            create_or_update_neurostore_study(ns_study)
            db.session.add(ns_study)
            commit_session()

        return cloned_project

    def _clone_references(
        self,
        ns_session,
        source_project,
        copy_annotations,
    ):
        """Clone studyset (and optionally annotation) via neurostore API.

        Returns (new_ss_ref_id, new_ann_ref_id) — both may be None.
        """
        source_ss_ref_id = getattr(source_project, "neurostore_studyset_id", None)
        if not source_ss_ref_id:
            return None, None

        query_params = {"source_id": source_ss_ref_id}
        if copy_annotations is None and source_project.neurostore_annotation_id:
            query_params["copy_annotations"] = "true"
        elif copy_annotations is not None:
            query_params["copy_annotations"] = str(bool(copy_annotations)).lower()

        path = "/api/studysets/"
        if query_params:
            path = f"{path}?{urlencode(query_params)}"

        ns_response = ns_session.post(path, json={})
        ns_payload = ns_response.json()

        new_ss_ref_id = ns_payload.get("id")
        if new_ss_ref_id:
            self._get_or_create_reference(NeurostoreStudyset, new_ss_ref_id)

        new_ann_ref_id = None
        source_ann_ref_id = getattr(source_project, "neurostore_annotation_id", None)
        annotations_payload = ns_payload.get("annotations") or []
        annotation_id = (
            annotations_payload[0].get("id") if annotations_payload else None
        )
        if (
            source_ann_ref_id
            and annotation_id
            and (copy_annotations is None or copy_annotations)
        ):
            new_ann_ref_id = annotation_id
            self._get_or_create_reference(NeurostoreAnnotation, new_ann_ref_id)

        return new_ss_ref_id, new_ann_ref_id

    def _clone_meta_analysis(self, meta, user, project, new_ss_ref_id, new_ann_ref_id):
        cloned_spec = self._clone_specification(meta.specification, user)
        cloned_meta = MetaAnalysis(
            name=meta.name,
            description=meta.description,
            public=project.public,
            specification=cloned_spec,
            neurostore_studyset_id=new_ss_ref_id,
            neurostore_annotation_id=new_ann_ref_id,
            user=user,
            project=project,
            provenance=self._clone_meta_provenance(
                meta.provenance,
                new_ss_ref_id,
                new_ann_ref_id,
            ),
        )
        return cloned_meta

    @staticmethod
    def _clone_specification(specification, user):
        if specification is None:
            return None
        cloned_spec = Specification(
            type=specification.type,
            estimator=deepcopy(specification.estimator),
            database_studyset=specification.database_studyset,
            filter=specification.filter,
            corrector=deepcopy(specification.corrector),
            user=user,
        )
        for spec_cond in specification.specification_conditions:
            cloned_cond = SpecificationCondition(
                weight=spec_cond.weight,
                condition=spec_cond.condition,
                user=user,
            )
            cloned_spec.specification_conditions.append(cloned_cond)
        return cloned_spec

    @staticmethod
    def _clone_provenance(provenance, studyset_id, annotation_id):
        if provenance is None:
            return None
        cloned = deepcopy(provenance)
        extraction = cloned.get("extractionMetadata", {})
        if studyset_id:
            extraction["studysetId"] = studyset_id
        if annotation_id:
            extraction["annotationId"] = annotation_id
        cloned["extractionMetadata"] = extraction
        meta_meta = cloned.get("metaAnalysisMetadata")
        if isinstance(meta_meta, dict):
            meta_meta["canEditMetaAnalyses"] = True
            cloned["metaAnalysisMetadata"] = meta_meta
        return cloned

    @staticmethod
    def _clone_meta_provenance(provenance, studyset_id, annotation_id):
        if provenance is None:
            return None
        cloned = deepcopy(provenance)
        if studyset_id:
            for key in ("studysetId", "studyset_id"):
                if key in cloned:
                    cloned[key] = studyset_id
        if annotation_id:
            for key in ("annotationId", "annotation_id"):
                if key in cloned:
                    cloned[key] = annotation_id
        for key in ("hasResults", "has_results"):
            if key in cloned:
                cloned[key] = False
        return cloned

    @staticmethod
    def _get_or_create_reference(model_cls, identifier):
        if identifier is None:
            return None
        existing = db.session.execute(
            select(model_cls).where(model_cls.id == identifier)
        ).scalar_one_or_none()
        if existing:
            return existing
        reference = model_cls(id=identifier)
        db.session.add(reference)
        return reference
