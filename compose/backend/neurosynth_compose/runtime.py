"""Framework-neutral runtime settings shared by handlers and workers."""

from __future__ import annotations

import logging
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class Runtime:
    config: Mapping[str, object]
    logger: logging.Logger


_default_runtime: Runtime | None = None
_runtime: ContextVar[Runtime | None] = ContextVar("compose_runtime", default=None)


def configure_runtime(config: Mapping[str, object], logger: logging.Logger) -> Runtime:
    global _default_runtime
    runtime = Runtime(config=config, logger=logger)
    _default_runtime = runtime
    _runtime.set(runtime)
    return runtime


def get_runtime() -> Runtime:
    runtime = _runtime.get() or _default_runtime
    if runtime is None:
        raise RuntimeError("Compose runtime settings have not been configured.")
    return runtime
