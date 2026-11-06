"""Stream the zip of a layout as a download; its temporary directory goes when the stream ends."""

import tempfile
import zipfile
from pathlib import Path

from starlette.concurrency import run_in_threadpool
from starlette.requests import ClientDisconnect
from starlette.responses import StreamingResponse

CHUNK_BYTES = 64 * 1024


class _Pipe:
    """A write-only file whose bytes are taken out as they are written."""

    # Unseekable on purpose: zipfile then writes data descriptors instead of seeking back.
    def __init__(self):
        self._written = bytearray()

    def write(self, data):
        self._written += data
        return len(data)

    def flush(self):
        pass

    def take(self):
        data = bytes(self._written)
        self._written.clear()
        return data


def _zip_chunks(root):
    """The zip of every file under ``root``, by sorted path, in chunks of at most about
    CHUNK_BYTES."""
    pipe = _Pipe()
    with zipfile.ZipFile(pipe, "w") as zipped:
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            info = zipfile.ZipInfo.from_file(path, path.relative_to(root).as_posix())
            with path.open("rb") as source, zipped.open(info, "w") as entry:
                while chunk := source.read(CHUNK_BYTES):
                    entry.write(chunk)
                    yield pipe.take()
    # Closing the archive wrote the central directory; this chunk carries it.
    yield pipe.take()


class _ZipStream(StreamingResponse):
    """Writes the layout, streams its zip, then removes the temporary directory however that ends.

    A failed write, a finished stream and a cancelled stream all end in the one ``finally``.
    A disconnected client ends it too, as a cancellation under ASGI spec 2.3 and as
    ClientDisconnect under 2.4; both are covered by tests.
    """

    def __init__(self, write, filename):
        self._write = write
        self._directory = tempfile.TemporaryDirectory()
        self._root = Path(self._directory.name) / "layout"
        super().__init__(
            _zip_chunks(self._root),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    async def __call__(self, scope, receive, send):
        try:
            await run_in_threadpool(self._write, self._root)
            await super().__call__(scope, receive, send)
        except ClientDisconnect:
            pass
        finally:
            self._directory.cleanup()


def stream_zip(write, filename):
    """A response streaming the zip of the layout ``write(root)`` writes, as an attachment
    named ``filename``."""
    return _ZipStream(write, filename)
