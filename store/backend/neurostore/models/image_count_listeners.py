import sqlalchemy as sa
from sqlalchemy import event, inspect

from neurostore.models.data import Image


def _sync_analysis_image_count(connection, analysis_id):
    if not analysis_id:
        return

    connection.execute(
        sa.text(
            """
            UPDATE analyses
            SET image_count = (
                SELECT COUNT(*)::integer
                FROM images
                WHERE analysis_id = :analysis_id
            )
            WHERE id = :analysis_id
            """
        ),
        {"analysis_id": analysis_id},
    )


@event.listens_for(Image, "after_insert")
def _after_insert_image(_mapper, connection, target):
    _sync_analysis_image_count(connection, target.analysis_id)


@event.listens_for(Image, "after_delete")
def _after_delete_image(_mapper, connection, target):
    _sync_analysis_image_count(connection, target.analysis_id)


@event.listens_for(Image, "after_update")
def _after_update_image(_mapper, connection, target):
    history = inspect(target).attrs.analysis_id.history

    if not history.has_changes():
        return

    for analysis_id in set([*history.deleted, *history.added]):
        _sync_analysis_image_count(connection, analysis_id)
