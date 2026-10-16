"""The review core, and every neurostore module it reaches, imports no web framework and no
database layer."""

import ast
import importlib.util
from pathlib import Path

import pytest

CORE_PACKAGE = "neurostore.review.core"
REVIEW_PACKAGE = "neurostore.review"
CORE = Path(importlib.util.find_spec(CORE_PACKAGE).origin).parent
FORBIDDEN = (
    "flask",
    "connexion",
    "starlette",
    "sqlalchemy",
    "neurostore.database",
    "neurostore.exceptions",
    "neurostore.models",
    "neurostore.review.app",
)


def _is_package(module):
    return importlib.util.find_spec(module).submodule_search_locations is not None


def _absolute(module, node):
    """The module a from-import names; a relative one is resolved against ``module``'s package."""
    if node.level == 0:
        return node.module
    package = module if _is_package(module) else module.rpartition(".")[0]
    base = package.rsplit(".", node.level - 1)[0]
    return f"{base}.{node.module}" if node.module else base


def _imports(module):
    """The names of the modules ``module``'s source imports, wherever in the file."""
    origin = importlib.util.find_spec(module).origin
    tree = ast.parse(Path(origin).read_text("utf-8"))
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            source = _absolute(module, node)
            names.add(source)
            if source.startswith("neurostore") and _is_package(source):
                names.update(
                    f"{source}.{alias.name}"
                    for alias in node.names
                    if importlib.util.find_spec(f"{source}.{alias.name}") is not None
                )
    return names


def _run_by_importing(module):
    """``module`` and the packages of the review that importing it also runs."""
    parts = module.split(".")
    depth = len(REVIEW_PACKAGE.split("."))
    parents = [".".join(parts[:n]) for n in range(depth, len(parts))]
    return [module, *parents] if module.startswith(REVIEW_PACKAGE) else [module]


def _reached(module):
    """Every module ``module`` imports, following the neurostore ones."""
    seen, todo = set(), [module]
    while todo:
        for name in _run_by_importing(todo.pop()):
            for imported in _imports(name):
                if imported not in seen:
                    seen.add(imported)
                    if imported.startswith("neurostore."):
                        todo.append(imported)
    return seen


CORE_MODULES = [
    CORE_PACKAGE if path.stem == "__init__" else f"{CORE_PACKAGE}.{path.stem}"
    for path in sorted(CORE.glob("*.py"))
] + ["neurostore.review.errors"]


@pytest.mark.parametrize("module", CORE_MODULES)
def test_a_core_module_reaches_no_web_or_database_module(module):
    reached = _reached(module)
    assert [
        name for name in sorted(reached)
        if any(name == banned or name.startswith(f"{banned}.") for banned in FORBIDDEN)
    ] == []
