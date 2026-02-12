import sqlalchemy as sa

from ..database import db


def normalize_ids(ids):
    if not ids:
        return []
    return sorted({id_ for id_ in ids if id_})


def merge_unique_ids(*unique_ids_dicts):
    merged = {}
    for unique_ids in unique_ids_dicts:
        if not unique_ids:
            continue
        for key, values in unique_ids.items():
            if not values:
                continue
            if isinstance(values, set):
                vals = values
            elif isinstance(values, (list, tuple)):
                vals = {v for v in values if v}
            else:
                vals = {values}
            merged.setdefault(key, set()).update(vals)
    return merged


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
