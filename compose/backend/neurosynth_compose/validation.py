from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from starlette.datastructures import Headers, UploadFile
from starlette.types import Receive, Scope

from connexion.exceptions import BadRequestProblem
from connexion.validators.form_data import MultiPartFormDataValidator


class ReplayableMultiPartFormDataValidator(MultiPartFormDataValidator):
    """Validate multipart bodies and replay the complete ASGI body downstream."""

    def _validation_body(self, form_data):
        if self._uri_parser is None:
            return {key: form_data.getlist(key) for key in form_data}

        form_fields = {}
        file_fields: dict[str, str | list[str]] = {}
        for key in form_data.keys():
            param_schema = self._schema.get("properties", {}).get(key, {})
            value = form_data.getlist(key)

            def is_file(schema):
                return schema.get("type") == "string" and schema.get("format") in [
                    "binary",
                    "base64",
                ]

            if is_file(param_schema):
                file_fields[key] = "" if len(value) == 1 else [""] * len(value)
            elif is_file(param_schema.get("items", {})):
                file_fields[key] = [""] * len(value)
            elif value and isinstance(value[0], UploadFile):
                file_fields[key] = [""] * len(value)
            else:
                form_fields[key] = value

        body = self._uri_parser.resolve_form(form_fields)
        body.update(file_fields)
        return body

    async def wrap_receive(self, receive: Receive, *, scope: Scope):
        headers = Headers(scope=scope)
        if not int(headers.get("content-length", 0)):
            body = self._schema.get("default")
            if body is None and self._required:
                raise BadRequestProblem("RequestBody is required")
            return self._insert_body(receive, body=body, scope=scope)

        messages: list[dict[str, Any]] = []
        more_body = True
        while more_body:
            message = await receive()
            messages.append(message)
            more_body = message.get("more_body", False)

        async def stream() -> AsyncGenerator[bytes, None]:
            for message in messages:
                yield message.get("body", b"")
            yield b""

        form_data = await self._form_parser_cls(headers, stream()).parse()
        scope.setdefault("extensions", {})["compose_multipart_form_data"] = form_data

        body = self._validation_body(form_data)
        if not (body is None and self._nullable):
            self._validate(body)

        return self._insert_messages(receive, messages=messages), scope
