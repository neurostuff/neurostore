import re
import sys

from connexion.exceptions import ResolverError
from connexion.resolver import MethodViewResolver, RestyResolver


class MethodListViewResolver(MethodViewResolver):
    """
    Resolves endpoint functions based on Flask's MethodView semantics, e.g. ::

            paths:
                /foo_bar:
                    get:
                        # Implied function call: api.FooBarView().get

            class FooBarView(MethodView):
                def get(self):
                    return ...
                def post(self):
                    return ...
    """

    def resolve_operation_id(self, operation):
        """
        Resolves the operationId using REST semantics unless explicitly configured in the spec
        Once resolved with REST semantics the view_name is capitalised and has 'View' added
        to it so it now matches the Class names of the MethodView

        :type operation: connexion.operations.AbstractOperation
        """
        if operation.operation_id:
            # If operation_id is defined then use the higher level API to resolve
            return RestyResolver.resolve_operation_id(self, operation)

        # Use RestyResolver to get operation_id for us (follow their naming conventions/structure)
        operation_id = self.resolve_operation_id_using_rest_semantics(operation)
        module_name, view_base, meth_name = operation_id.rsplit(".", 2)
        if re.search(r"\{.*\}$", operation.path):
            view_suffix = "View"
        else:
            view_suffix = "ListView"

        view_name = view_base[0].upper() + view_base[1:] + view_suffix

        return "{}.{}.{}".format(module_name, view_name, meth_name)

    def resolve_function_from_operation_id(self, operation_id):
        """
        Invokes the function_resolver

        :type operation_id: str
        """

        try:
            module_name, view_name, meth_name = operation_id.rsplit(".", 2)
            if operation_id and not view_name.endswith("View"):
                # If operation_id is not a view then assume it is a standard function
                return self.function_resolver(operation_id)

            mod = __import__(module_name, fromlist=[view_name])
            view_cls = getattr(mod, view_name)
            # Find the class and instantiate it
            view = view_cls()
            func = getattr(view, meth_name)
            # Return the method function of the class
            return func
        except ImportError as e:
            msg = 'Cannot resolve operationId "{}"! Import error was "{}"'.format(
                operation_id, str(e)
            )
            raise ResolverError(msg, sys.exc_info())
        except (AttributeError, ValueError) as e:
            raise ResolverError(str(e), sys.exc_info())
