"""Encryption for what Store keeps but never serves: corresponding authors' emails.

A value is stored as a Fernet token (AES-128-CBC with an HMAC-SHA256) under
`CONTACT_EMAIL_KEY`, so the database and its dumps hold ciphertext only. Fernet
tokens differ on every write, so an address is also kept as a keyed hash of its
normalised form (`email_index`), which finds it without decrypting anything.
The hash key is derived from the same key: changing the key means re-encrypting
and re-indexing every row.
"""

from __future__ import annotations

import base64
import functools
import hashlib
import hmac

import sqlalchemy as sa
from cryptography.fernet import Fernet

from neurostore.settings import load_settings

KEY_SETTING = "CONTACT_EMAIL_KEY"


@functools.cache
def _key() -> bytes:
    key = load_settings().get(KEY_SETTING)
    if not key:
        raise RuntimeError(
            f"{KEY_SETTING} is not set: corresponding author emails cannot be read or written."
        )
    return key.encode() if isinstance(key, str) else key


def _index_key() -> bytes:
    return hmac.new(base64.urlsafe_b64decode(_key()), b"email index", hashlib.sha256).digest()


def email_index(email: str) -> str:
    """The keyed hash an address is found by; the same for any case or surrounding space."""
    return hmac.new(_index_key(), email.strip().lower().encode(), hashlib.sha256).hexdigest()


class EncryptedText(sa.types.TypeDecorator):
    """Text stored as a Fernet token and read back as the text."""

    impl = sa.Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return None if value is None else Fernet(_key()).encrypt(value.encode()).decode()

    def process_result_value(self, value, dialect):
        return None if value is None else Fernet(_key()).decrypt(value.encode()).decode()
