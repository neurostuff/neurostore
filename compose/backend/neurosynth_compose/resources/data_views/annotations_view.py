from __future__ import annotations

from neurosynth_compose.database import commit_session, db
from neurosynth_compose.models.analysis import Annotation  # noqa: F401
from neurosynth_compose.models.analysis import AnnotationReference  # noqa: F401
from neurosynth_compose.resources.common import get_current_user
from neurosynth_compose.resources.resource_services import ensure_canonical_annotation
from neurosynth_compose.resources.view_core import ListView, ObjectView, view_maker
from neurosynth_compose.schemas import AnnotationReferenceSchema  # noqa: F401
from neurosynth_compose.schemas import AnnotationSchema  # noqa: F401


@view_maker
class AnnotationsView(ObjectView, ListView):
    _nested = {
        "annotation_reference": "AnnotationReferencesResource",
        "studyset": "StudysetsView",
    }

    def serialize_record(self, record, args):
        from neurosynth_compose.resources.data_views.meta_analyses_view import (
            _serialize_annotation,
        )

        return _serialize_annotation(record)

    @classmethod
    def update_or_create(
        cls, data, id=None, *, commit=True, user=None, record=None, flush=True
    ):
        if isinstance(data, dict) and data.get("snapshot") is not None and id is None:
            current_user = user or get_current_user()
            user_id = (
                getattr(current_user, "external_id", None) if current_user else None
            )
            canonical = ensure_canonical_annotation(
                db.session,
                data.get("snapshot"),
                user_id=user_id,
                neurostore_id=data.get("neurostore_id"),
                cached_studyset_id=data.get("cached_studyset_id"),
            )
            if commit and canonical is not None:
                db.session.add(canonical)
                commit_session()
            return canonical
        return super().update_or_create(
            data, id=id, commit=commit, user=user, record=record, flush=flush
        )
