from collections import OrderedDict


ALLOWED_NOTE_KEY_TYPES = {"string", "number", "boolean"}


def implicit_note_key_default(key, note_type):
    if note_type == "boolean":
        return key == "included"
    if note_type in {"string", "number"}:
        return None
    return None


def resolve_note_key_default(
    key, note_type, default_provided=False, default_value=None
):
    if default_provided:
        return default_value
    return implicit_note_key_default(key, note_type)


def ordered_note_key_names(note_keys):
    if not note_keys:
        return []
    keys = list(note_keys.keys())
    alphabetical = sorted(keys)
    return alphabetical if keys == alphabetical else keys


def canonicalize_note_keys(
    note_keys,
    fail,
    mapping_factory=OrderedDict,
    invalid_root_message="`note_keys` must be an object.",
    invalid_descriptor_message="Each note key must map to an object.",
    invalid_type_message=None,
    invalid_default_message=None,
):
    if not isinstance(note_keys, dict):
        fail(invalid_root_message)

    invalid_type_message = invalid_type_message or (
        lambda key: f"Invalid note type for '{key}', choose from: {sorted(ALLOWED_NOTE_KEY_TYPES)}"
    )
    invalid_default_message = invalid_default_message or (
        lambda key, note_type: f"Invalid default for '{key}', expected a {note_type}."
    )

    normalized = mapping_factory()
    used_orders = set()
    explicit_orders = []
    for descriptor in note_keys.values():
        if isinstance(descriptor, dict) and isinstance(descriptor.get("order"), int):
            explicit_orders.append(descriptor["order"])
    next_order = max(explicit_orders, default=-1) + 1

    for key in ordered_note_key_names(note_keys):
        descriptor = note_keys.get(key)
        if not isinstance(descriptor, dict):
            fail(invalid_descriptor_message)

        note_type = descriptor.get("type")
        if note_type not in ALLOWED_NOTE_KEY_TYPES:
            fail(invalid_type_message(key))

        default_provided = "default" in descriptor
        default_value = descriptor.get("default") if default_provided else None
        if default_provided and default_value is not None:
            invalid_default = False
            if note_type == "boolean":
                invalid_default = not isinstance(default_value, bool)
            elif note_type == "number":
                invalid_default = (
                    not isinstance(default_value, (int, float))
                    or isinstance(default_value, bool)
                )
            elif note_type == "string":
                invalid_default = not isinstance(default_value, str)
            if invalid_default:
                fail(invalid_default_message(key, note_type))

        order = descriptor.get("order")
        if isinstance(order, bool) or (
            order is not None and not isinstance(order, int)
        ):
            order = None

        if isinstance(order, int) and order not in used_orders:
            used_orders.add(order)
            if order >= next_order:
                next_order = order + 1
        else:
            while next_order in used_orders:
                next_order += 1
            order = next_order
            used_orders.add(order)
            next_order += 1

        normalized[key] = {
            "type": note_type,
            "order": order,
            "default": resolve_note_key_default(
                key,
                note_type,
                default_provided=default_provided,
                default_value=default_value,
            ),
        }

    return normalized
