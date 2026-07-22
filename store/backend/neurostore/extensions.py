"""Framework-neutral extensions used by the Store service."""

from __future__ import annotations

from functools import wraps
from typing import Callable, Mapping

from cachelib.redis import RedisCache
from redis import from_url


class Cache:
    """Subset of Flask-Caching used by Store, backed by Cachelib RedisCache.

    Cachelib uses the same Redis value representation as Flask-Caching's
    Redis backend, so existing cache entries remain readable after the switch.
    """

    def __init__(self):
        self.cache: RedisCache | None = None

    def init_app(self, config: Mapping[str, object]):
        redis_url = str(config["CACHE_REDIS_URL"])
        key_prefix = config.get("CACHE_KEY_PREFIX")
        self.cache = RedisCache(
            host=from_url(redis_url),
            default_timeout=300,
            key_prefix=str(key_prefix) if key_prefix else None,
        )
        return self

    def _backend(self) -> RedisCache:
        if self.cache is None:
            raise RuntimeError("Cache has not been configured.")
        return self.cache

    def clear(self):
        return self._backend().clear()

    def cached(
        self,
        timeout: int | None = None,
        query_string: bool = False,
        make_cache_key: Callable | None = None,
        key_prefix: str | None = None,
    ):
        """Cache a synchronous endpoint result using its existing key function."""
        del query_string  # The Store key functions already include query parameters.

        def decorator(function):
            @wraps(function)
            def decorated(*args, **kwargs):
                if make_cache_key is not None:
                    cache_key = make_cache_key(*args, **kwargs)
                elif key_prefix is not None:
                    cache_key = key_prefix
                else:
                    cache_key = function.__name__

                backend = self._backend()
                value = backend.get(cache_key)
                if value is not None:
                    return value

                value = function(*args, **kwargs)
                backend.set(cache_key, value, timeout=timeout)
                return value

            return decorated

        return decorator


cache = Cache()
