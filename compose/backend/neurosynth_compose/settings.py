"""Framework-neutral Compose configuration loading."""

from __future__ import annotations

import importlib

from neurosynth_compose.config import resolve_config_object


def load_settings() -> dict[str, object]:
    dotted_path = resolve_config_object()
    module_name, class_name = dotted_path.rsplit(".", 1)
    config_cls = getattr(importlib.import_module(module_name), class_name)
    return {
        name: getattr(config_cls, name)
        for name in dir(config_cls)
        if name.isupper()
    }
