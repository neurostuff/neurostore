def ordered_note_keys(type_map):
    """
    Build ordered note key descriptors from a simple name->type mapping.
    """
    return {
        key: {"type": value_type, "order": idx}
        for idx, (key, value_type) in enumerate(type_map.items())
    }
