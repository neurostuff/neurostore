"""A record's owner as the API serves them: their Auth0 id goes only to themselves."""

from contextlib import contextmanager

from connexion.context import context
from marshmallow import fields, missing

_SEEN = "owners_seen"


def owner_id(user_id):
    """``user_id`` (an Auth0 subject) when it is the caller's own, else None.

    Another user's Auth0 id is never served; their ``username`` is.
    """
    try:
        caller = context.get("user")
        seen = context.get(_SEEN)
    except (LookupError, RuntimeError):
        return None
    if seen is not None and user_id is not None:
        seen.add(user_id)
    return user_id if user_id is not None and user_id == caller else None


@contextmanager
def collecting_owners():
    """The owners `owner_id` is asked about inside the block: the users whose response
    would differ from everyone else's."""
    seen = set()
    context[_SEEN] = seen
    try:
        yield seen
    finally:
        context.pop(_SEEN, None)


class OwnerId(fields.String):
    """A record's ``user_id``, dumped through `owner_id`.

    Ignored on load, so a client echoing back the null it was served is not refused; the
    owner is set by the server.
    """

    def _serialize(self, value, attr, obj, **kwargs):
        return super()._serialize(owner_id(value), attr, obj, **kwargs)

    def deserialize(self, value, attr=None, data=None, **kwargs):
        return missing
