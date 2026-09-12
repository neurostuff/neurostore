"""Sentry error reporting.

Enabled only when ``SENTRY_DSN`` is set, so development, test and CI runs are
unaffected. Connexion registers its own handler for ``Exception``, which means
Starlette's error middleware -- and therefore Sentry's ASGI integration -- never
sees an unhandled exception. ``capture_exception`` is called from the error
handlers instead.
"""

import logging

logger = logging.getLogger(__name__)

_initialized = False


def _sample_rate(settings, name, default=0.0):
    value = settings.get(name, default)
    try:
        rate = float(value)
    except (TypeError, ValueError):
        logger.warning("Ignoring non-numeric %s=%r", name, value)
        return default
    return min(max(rate, 0.0), 1.0)


def is_enabled():
    return _initialized


def configure_sentry(settings, component="api", integrations=None):
    """Start Sentry when a DSN is configured. Returns whether it is enabled.

    ``integrations`` is a callable returning sentry integrations, called only
    once sentry-sdk has imported, so callers never import it themselves.
    """
    global _initialized

    if _initialized:
        return True

    dsn = settings.get("SENTRY_DSN")
    if not dsn:
        return False

    try:
        import sentry_sdk
    except ImportError:  # pragma: no cover - dependency is declared
        logger.warning("SENTRY_DSN is set but sentry-sdk is not installed")
        return False

    sentry_sdk.init(
        dsn=dsn,
        environment=str(settings.get("ENV") or "unknown"),
        release=settings.get("SENTRY_RELEASE") or None,
        traces_sample_rate=_sample_rate(settings, "SENTRY_TRACES_SAMPLE_RATE"),
        profiles_sample_rate=_sample_rate(settings, "SENTRY_PROFILES_SAMPLE_RATE"),
        # request bodies and auth headers can carry unpublished study data
        send_default_pii=False,
        integrations=list(integrations() if integrations else []),
    )
    sentry_sdk.set_tag("component", component)
    _initialized = True
    logger.info("Sentry enabled for environment %s", settings.get("ENV"))
    return True


def capture_exception(exc, request=None):
    """Report an exception, tagged with the request that raised it.

    A no-op when Sentry is not configured.
    """
    if not _initialized:
        return None

    import sentry_sdk

    with sentry_sdk.new_scope() as scope:
        context = request_context(request)
        if context:
            scope.set_context("request", context)
            scope.set_transaction_name(context.get("url") or "unknown")
        return sentry_sdk.capture_exception(exc)


def request_context(request):
    """The subset of a request worth attaching to an error report."""
    if request is None:
        return {}

    url = getattr(request, "url", None)
    context = {
        "method": getattr(request, "method", None),
        "url": str(url) if url is not None else None,
    }
    query_params = getattr(request, "query_params", None)
    if query_params:
        context["query_string"] = str(query_params)
    return {key: value for key, value in context.items() if value is not None}
