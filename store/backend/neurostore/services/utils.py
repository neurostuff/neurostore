import sqlalchemy as sa
from neurostore.database import db


def outbox_health_snapshot(
    model_cls, id_column_name="base_study_id", ts_column_name="updated_at"
):
    id_column = getattr(model_cls, id_column_name)
    ts_column = getattr(model_cls, ts_column_name)
    pending_rows, oldest_age_seconds = db.session.execute(
        sa.select(
            sa.func.count(id_column),
            sa.func.coalesce(
                sa.func.max(
                    sa.func.extract(
                        "epoch",
                        sa.func.now() - ts_column,
                    )
                ),
                0.0,
            ),
        )
    ).one()
    return int(pending_rows or 0), float(oldest_age_seconds or 0.0)
