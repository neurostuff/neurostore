from webargs import fields

from neurostore.exceptions.utils.error_helpers import abort_validation
from neurostore.schemas import BooleanOrString

LIST_CLONE_ARGS = {
    "source_id": fields.String(load_default=None),
    "source": fields.String(load_default=None),
    "unique": BooleanOrString(load_default=False),
}

LIST_NESTED_ARGS = {
    "nested": fields.Boolean(load_default=False),
}

LIST_SUMMARY_ARGS = {
    "summary": fields.Boolean(load_default=False),
}

MAP_TYPE_QUERY_FIELDS = {
    "z": "has_z_maps",
    "t": "has_t_maps",
    "beta_variance": "has_beta_and_variance_maps",
}


def apply_map_type_filter(query, model, map_type):
    if not map_type:
        return query

    normalized = str(map_type).strip().lower()
    if normalized == "any":
        return query.filter(model.has_images.is_(True))

    mapped_field = MAP_TYPE_QUERY_FIELDS.get(normalized)
    if mapped_field is None:
        abort_validation("map_type must be one of: z, t, beta_variance, any")
    return query.filter(getattr(model, mapped_field).is_(True))
