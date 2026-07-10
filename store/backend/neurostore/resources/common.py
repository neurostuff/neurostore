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
