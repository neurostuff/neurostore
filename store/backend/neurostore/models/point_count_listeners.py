import sqlalchemy as sa
from sqlalchemy import event, inspect

from .data import Point


def _sync_analysis_point_count(connection, analysis_id):
    if not analysis_id:
        return

    connection.execute(
        sa.text(
            """
            UPDATE analyses
            SET point_count = (
                SELECT COUNT(*)::integer
                FROM points
                WHERE analysis_id = :analysis_id
            )
            WHERE id = :analysis_id
            """
        ),
        {"analysis_id": analysis_id},
    )


@event.listens_for(Point, "after_insert")
def _after_insert_point(_mapper, connection, target):
    _sync_analysis_point_count(connection, target.analysis_id)


@event.listens_for(Point, "after_delete")
def _after_delete_point(_mapper, connection, target):
    _sync_analysis_point_count(connection, target.analysis_id)


@event.listens_for(Point, "after_update")
def _after_update_point(_mapper, connection, target):
    history = inspect(target).attrs.analysis_id.history

    if not history.has_changes():
        return

    for analysis_id in set([*history.deleted, *history.added]):
        _sync_analysis_point_count(connection, analysis_id)
