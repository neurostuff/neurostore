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
