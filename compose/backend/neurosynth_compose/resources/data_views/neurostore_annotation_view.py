from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from neurosynth_compose.models.analysis import (
    NeurostoreAnnotation,
    SnapshotAnnotation,
)  # noqa: F401
from neurosynth_compose.resources.view_core import ObjectView, view_maker
from neurosynth_compose.schemas import NeurostoreAnnotationSchema  # noqa: F401


@view_maker
class NeurostoreAnnotationsView(ObjectView):
    @staticmethod
    def _snapshot_options():
        return (
            selectinload(NeurostoreAnnotation.snapshot_annotations).load_only(
                SnapshotAnnotation.id,
                SnapshotAnnotation.md5,
            ),
        )

    def load_query(self, args=None):
        return select(self._model).options(*self._snapshot_options())

    def load_object_query(self, id, args=None):
        return (
            select(self._model)
            .options(*self._snapshot_options())
            .where(self._model.id == id)
        )
