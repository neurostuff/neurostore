"""API keys: created and revoked with a login token, accepted as bearer tokens by
Store and, through /api-keys/introspect, by Compose."""

from datetime import datetime, timezone

from connexion.context import context

from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import (
    abort_not_found,
    abort_permission,
    abort_validation,
)
from neurostore.models import ApiKey
from neurostore.resources.auth import generate_api_key, hash_api_key
from neurostore.resources.mutation_core import resolve_current_user


def _dump(api_key):
    return {
        "id": api_key.id,
        "name": api_key.name,
        "prefix": api_key.prefix,
        "scopes": list(api_key.scopes),
        "created_at": api_key.created_at,
        "last_used_at": api_key.last_used_at,
        "revoked_at": api_key.revoked_at,
    }


def _api_key_id():
    return context.get("token_info", {}).get("api_key_id")


def _login_user():
    # a leaked key must not be able to mint or revoke keys
    if _api_key_id():
        abort_permission("API keys are managed with a login token, not an API key.")
    return resolve_current_user()


class ApiKeysView:
    def search(self):
        user = _login_user()
        keys = (
            ApiKey.query.filter_by(user_id=user.external_id)
            .order_by(ApiKey.created_at.desc())
            .all()
        )
        return {"results": [_dump(k) for k in keys]}

    def post(self, body):
        user = _login_user()
        key, prefix = generate_api_key()
        api_key = ApiKey(
            user_id=user.external_id,
            name=body["name"],
            prefix=prefix,
            key_hash=hash_api_key(key),
            scopes=sorted(set(body["scopes"])),
        )
        db.session.add(api_key)
        db.session.commit()
        return {**_dump(api_key), "key": key}, 201

    def delete(self, id):
        user = _login_user()
        api_key = ApiKey.query.filter_by(id=id, user_id=user.external_id).first()
        if api_key is None:
            abort_not_found("ApiKey", id)
        if api_key.revoked_at is None:
            api_key.revoked_at = datetime.now(timezone.utc)
            db.session.commit()
        return None, 204


class IntrospectView:
    def search(self):
        token_info = context.get("token_info", {})
        if not token_info.get("api_key_id"):
            abort_validation("Introspection describes an API key; send one as the bearer token.")
        return {
            "user": token_info["sub"],
            "name": token_info["name"],
            "scopes": token_info["scopes"],
        }
