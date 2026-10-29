import sqlalchemy as sa
from sqlalchemy import event, inspect

from neurostore.models.data import BaseStudy
from neurostore.models.fulltext import Fulltext, refresh_fulltext_pointer


@event.listens_for(Fulltext, "after_insert")
@event.listens_for(Fulltext, "after_delete")
def _after_fulltext_change(_mapper, connection, target):
    refresh_fulltext_pointer(connection, target.base_study_id)


@event.listens_for(Fulltext, "after_update")
def _after_update_fulltext(_mapper, connection, target):
    attrs = inspect(target).attrs
    history = attrs.base_study_id.history

    if history.has_changes():
        # An expired attribute has no old value in its history: the base study
        # the row moved from is whichever still points to it.
        pointing = connection.execute(
            sa.select(BaseStudy.__table__.c.id).where(
                BaseStudy.__table__.c.fulltext_id == target.id
            )
        ).scalars()
        for base_study_id in {*history.deleted, *pointing, target.base_study_id}:
            refresh_fulltext_pointer(connection, base_study_id)
    elif attrs.text_copy.history.has_changes() or attrs.source.history.has_changes():
        refresh_fulltext_pointer(connection, target.base_study_id)
