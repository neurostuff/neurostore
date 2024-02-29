"""
Utilities for changing the loading structure for queries
"""

from sqlalchemy.orm import subqueryload
from sqlalchemy.orm.strategy_options import _UnboundLoad
from . import data


def nested_load(view, options=None, include_linked=False):
    """
    SQL: Change lazy loading to eager loading when accessing all
    nested attributes.
    """
    nested_keys = list(view._nested.keys())
    if include_linked:
        nested_keys.extend(view._linked.keys())
    if "entities" in nested_keys:
        nested_keys.remove("entities")
    if len(nested_keys) == 1:
        if options:
            options = options.subqueryload(getattr(view._model, nested_keys[0]))
        else:
            options = subqueryload(getattr(view._model, nested_keys[0]))
        nested_view = getattr(data, view._nested[nested_keys[0]])
        if nested_view._nested:
            options = nested_load(nested_view, options)
    elif len(nested_keys) > 1:
        nested_loads = []
        for k in nested_keys:
            nested_view = getattr(data, view._nested.get(k, ""), None) or getattr(
                data, view._linked.get(k, "")
            )
            if nested_view._nested:
                nested_loads.append(
                    nested_load(nested_view, subqueryload(getattr(view._model, k)))
                )
            else:
                nested_loads.append(subqueryload(getattr(view._model, k)))
        if options:
            options = options.options(*nested_loads)
        else:
            print("Error")

            options = _UnboundLoad().options(*nested_loads)
    return options
