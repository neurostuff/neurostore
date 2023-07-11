"""
Utilities for changing the loading structure for queries
"""
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.strategy_options import _UnboundLoad
from . import data


def nested_load(view, options=None):
    """
    SQL: Change lazy loading to eager loading when accessing all
    nested attributes.
    """
    nested_keys = list(view._nested.keys())
    if 'entities' in nested_keys:
        nested_keys.remove('entities')
    if len(nested_keys) == 1:
        if options:
            options = options.joinedload(getattr(view._model, nested_keys[0]))
        else:
            options = joinedload(getattr(view._model, nested_keys[0]))
        nested_view = getattr(data, view._nested[nested_keys[0]])
        if nested_view._nested:
            options = nested_load(nested_view, options)
    elif len(nested_keys) > 1:
        nested_loads = []
        for k in nested_keys:
            nested_view = getattr(data, view._nested[k])
            if nested_view._nested:
                nested_loads.append(
                    nested_load(nested_view, joinedload(getattr(view._model, k)))
                )
            else:
                nested_loads.append(joinedload(getattr(view._model, k)))
        if options:
            options = options.options(*nested_loads)
        else:
            print("Error")

            options = _UnboundLoad().options(*nested_loads)
    return options
