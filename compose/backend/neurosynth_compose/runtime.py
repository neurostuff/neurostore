"""Framework-neutral runtime settings shared by handlers and workers."""

from __future__ import annotations

import logging
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class Runtime:
    config: Mapping[str, object]
    logger: logging.Logger


_runtime: ContextVar[Runtime | None] = ContextVar("compose_runtime", default=None)


def configure_runtime(config: Mapping[str, object], logger: logging.Logger) -> Runtime:
    """Bind runtime dependencies in the current execution context."""
    runtime = Runtime(config=config, logger=logger)
    _runtime.set(runtime)
    return runtime


@contextmanager
def runtime_scope(config: Mapping[str, object], logger: logging.Logger):
    """Bind immutable runtime dependencies to one ASGI request or CLI command."""
    token = _runtime.set(Runtime(config=config, logger=logger))
    try:
        yield
    finally:
        _runtime.reset(token)


def get_runtime() -> Runtime:
    runtime = _runtime.get()
    if runtime is None:
        raise RuntimeError("Compose runtime settings have not been configured.")
    return runtime
