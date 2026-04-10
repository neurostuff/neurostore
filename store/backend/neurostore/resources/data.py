from neurostore.resources.data_views import DATA_VIEW_EXPORTS, DATA_VIEW_MODULES

__all__ = list(DATA_VIEW_EXPORTS)


def __getattr__(name):
    from importlib import import_module

    module_path = DATA_VIEW_MODULES.get(name)
    if module_path is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    module = import_module(module_path)
    value = getattr(module, name)
    globals()[name] = value
    return value
