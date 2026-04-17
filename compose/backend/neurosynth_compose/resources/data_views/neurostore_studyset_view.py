from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import load_only, selectinload

from neurosynth_compose.models.analysis import (
    NeurostoreStudyset,
    SnapshotStudyset,
)  # noqa: F401
from neurosynth_compose.resources.view_core import ListView, ObjectView, view_maker
from neurosynth_compose.schemas import NeurostoreStudysetSchema  # noqa: F401


@view_maker
class NeurostoreStudysetsView(ObjectView, ListView):
    @staticmethod
    def _snapshot_options():
        return (
            selectinload(NeurostoreStudyset.snapshot_studysets).load_only(
                SnapshotStudyset.id,
                SnapshotStudyset.md5,
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
