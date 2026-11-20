"""The provenance keys of review targets: one key per target."""


def target_key(target):
    """A target as one string (review-bundle.schema.json#/$defs/TargetKey)."""
    kind = target["kind"]
    if kind == "slot":
        return f"slot:{target['entity']}:{target['path']}"
    if kind == "entity":
        return f"entity:{target['entity']}"
    if kind == "relationship":
        return f"relationship:{target['entity']}:{target['path']}:{target['target_entity']}"
    if kind == "coordinate_analysis":
        return f"coordinate_analysis:{target['analysis_key']}"
    return "paper"
