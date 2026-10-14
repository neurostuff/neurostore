from sqlalchemy import event, inspect

from neurostore.models.fulltext import Fulltext, refresh_fulltext_pointer


@event.listens_for(Fulltext, "after_insert")
@event.listens_for(Fulltext, "after_delete")
def _after_fulltext_change(_mapper, connection, target):
    refresh_fulltext_pointer(connection, target.base_study_id)


@event.listens_for(Fulltext, "after_update")
def _after_update_fulltext(_mapper, connection, target):
    history = inspect(target).attrs.base_study_id.history

    if not history.has_changes():
        return

    for base_study_id in set([*history.deleted, *history.added]):
        refresh_fulltext_pointer(connection, base_study_id)
