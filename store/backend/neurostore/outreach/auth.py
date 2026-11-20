"""Who may use outreach's admin API.

An admin is an Auth0 user whose sub is listed in ``OUTREACH_ADMINS``. The admin API
decrypts authors' addresses, so no role an admin could grant through the site lets anyone
in. In development and tests only, ``OUTREACH_DEV_PASSWORD`` also lets in whoever sends it
as the password of HTTP basic auth.
"""

from __future__ import annotations

import base64
import binascii
import importlib
import inspect
from hmac import compare_digest

from connexion.exceptions import OAuthProblem
from starlette.exceptions import HTTPException

DEV_ENVIRONMENTS = ("development", "testing")
DEV_ACTOR = "dev-password"


def admin_subs(settings):
    listed = str(settings.get("OUTREACH_ADMINS") or "").split(",")
    return {sub.strip() for sub in listed if sub.strip()}


async def _token_info(token, request, settings):
    """The bearer token's claims, decoded by ``BEARERINFO_FUNC`` as the main API does."""
    module_name, _, name = str(settings["BEARERINFO_FUNC"]).rpartition(".")
    decode = getattr(importlib.import_module(module_name), name)
    accepted = inspect.signature(decode).parameters
    kwargs = {}
    if "settings" in accepted:
        kwargs["settings"] = settings
    elif "request" in accepted:
        kwargs["request"] = request
    info = decode(token, **kwargs)
    return await info if inspect.isawaitable(info) else info


def dev_password(settings):
    """The development password, or None where it is not honoured."""
    if settings.get("ENV") not in DEV_ENVIRONMENTS:
        return None
    return settings.get("OUTREACH_DEV_PASSWORD") or None


def _basic_password(credentials):
    try:
        decoded = base64.b64decode(credentials, validate=True).decode()
    except (binascii.Error, UnicodeDecodeError):
        return None
    return decoded.partition(":")[2]


async def outreach_admin(request):
    """The acting admin's id (their Auth0 sub), or a 401/403."""
    settings = request.state.settings
    scheme, _, credentials = request.headers.get("authorization", "").partition(" ")
    scheme = scheme.lower()
    password = dev_password(settings)
    if scheme == "basic" and password is not None:
        given = _basic_password(credentials)
        if given is not None and compare_digest(given, password):
            return DEV_ACTOR
        raise HTTPException(401, "Wrong password.")
    if scheme != "bearer" or not credentials:
        raise HTTPException(401, "Sign in as an outreach admin.")
    try:
        payload = await _token_info(credentials, request, settings)
    except OAuthProblem as exc:
        raise HTTPException(401, exc.detail) from exc
    if not payload:
        raise HTTPException(401, "Unable to parse authentication token.")
    sub = payload.get("sub")
    if sub not in admin_subs(settings):
        raise HTTPException(403, "Not an outreach admin.")
    return sub
