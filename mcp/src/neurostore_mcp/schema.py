"""Smaller input schemas: the specs inline every nested record, which costs clients context."""

from __future__ import annotations

from typing import Any

DROP = {"example", "examples", "title", "readOnly", "xml", "externalDocs"}


def compact(schema: Any, max_depth: int = 3, description_chars: int = 300) -> Any:
    """Drop examples and read-only fields, and stop listing fields below `max_depth`.

    A record nested deeper keeps its type and description and accepts any fields: the
    agent learns them from what the read tools return.
    """

    limit = description_chars

    def walk(node: Any, depth: int) -> Any:
        if isinstance(node, list):
            return [walk(n, depth) for n in node]
        if not isinstance(node, dict):
            return node
        out: dict[str, Any] = {}
        for key, value in node.items():
            if key in DROP or key.startswith("x-"):
                continue
            if key == "properties" and isinstance(value, dict):
                if depth >= max_depth:
                    out["additionalProperties"] = True
                    continue
                out[key] = {
                    name: walk(sub, depth + 1)
                    for name, sub in value.items()
                    if not (isinstance(sub, dict) and sub.get("readOnly"))
                }
            elif key == "required" and isinstance(value, list) and depth >= max_depth:
                continue
            elif key == "description" and isinstance(value, str) and len(value) > limit:
                out[key] = value[:limit].rstrip() + "…"
            elif key in ("items", "anyOf", "oneOf", "allOf", "additionalProperties", "not"):
                out[key] = walk(value, depth)
            else:
                out[key] = value
        return out

    return walk(schema, 0)
