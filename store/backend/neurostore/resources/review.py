"""The /review API, open only to admin-reviewers."""

import shutil
import tempfile
import zipfile
from pathlib import Path

from connexion import request
from connexion.lifecycle import ConnexionResponse

from neurostore.database import db
from neurostore.exceptions.utils.error_helpers import (
    abort_not_found,
    abort_permission,
    abort_too_large,
)
from neurostore.resources.utils import get_current_user, is_user_admin, user_has_role
from neurostore.review.app import exports, imports, service
from neurostore.review.core import schemas

MAX_IMPORT_BYTES = 200 * 1024 * 1024
SCHEMA_CACHE_CONTROL = "private, no-cache"


def _reviewer():
    user = get_current_user()
    if not user_has_role(user, "admin-reviewer"):
        abort_permission("Only an admin-reviewer can use /review.")
    return user


def _caller(user):
    return service.Caller(id=user.external_id, lead=is_user_admin(user))


def _lead_reviewer():
    user = _reviewer()
    if not is_user_admin(user):
        abort_permission("Only a lead reviewer (admin-reviewer and admin) can load papers.")
    return user


def _size(upload):
    if upload.size is not None:
        return upload.size
    upload.file.seek(0, 2)
    size = upload.file.tell()
    upload.file.seek(0)
    return size


def _spool(upload, destination):
    with destination.open("wb") as copy:
        shutil.copyfileobj(upload.file, copy)


def _zipped(write, filename):
    """The zip of the layout ``write(root)`` writes, as an attachment named ``filename``.

    The whole zip is built in memory before the response is sent.
    """
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory) / "layout"
        write(root)
        with tempfile.TemporaryFile() as archive:
            with zipfile.ZipFile(archive, "w") as zipped:
                for path in sorted(root.rglob("*")):
                    if path.is_file():
                        zipped.write(path, path.relative_to(root).as_posix())
            archive.seek(0)
            data = archive.read()
    return ConnexionResponse(
        body=data,
        status_code=200,
        content_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _commit(write):
    """``write()``'s result once what it flushed is committed; rolled back when either raises."""
    try:
        result = write()
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return result


def _matches(if_none_match, etag):
    tags = {tag.strip().removeprefix("W/") for tag in if_none_match.split(",")}
    return "*" in tags or etag in tags


class ReviewSchemasView:
    def get(self, name):
        _reviewer()
        schema = schemas.served(name)
        if schema is None:
            abort_not_found("schemas", name)
        headers = {"ETag": schema.etag, "Cache-Control": SCHEMA_CACHE_CONTROL}
        if _matches(request.headers.get("If-None-Match", ""), schema.etag):
            return ConnexionResponse(status_code=304, headers=headers)
        return ConnexionResponse(
            body=schema.body,
            status_code=200,
            content_type="application/json",
            headers=headers,
        )


class ReviewSourcesView:
    def search(self, page=1, page_size=20, base_study_id=None, mine=False, assigned=None):
        user = _reviewer()
        return service.list_sources(
            db.session,
            user.external_id,
            page=page,
            page_size=page_size,
            base_study_id=base_study_id,
            mine=mine,
            assigned=assigned,
        )


class ReviewMeView:
    def get(self):
        user = _reviewer()
        return {"user_id": user.external_id, "name": user.name, "lead": is_user_admin(user)}


class ReviewAssignmentsView:
    def get(self, id):
        _reviewer()
        return {"results": service.assignees(db.session, id)}

    def put(self, id, user_id):
        user = _reviewer()
        assignment, created = _commit(
            lambda: service.assign(db.session, id, user_id, _caller(user))
        )
        return assignment, 201 if created else 200

    def delete(self, id, user_id):
        user = _reviewer()
        _commit(lambda: service.release(db.session, id, user_id, _caller(user)))
        return ConnexionResponse(status_code=204)


class ReviewersView:
    def get(self):
        _reviewer()
        return {"results": service.reviewers(db.session)}


class ReviewBundlesView:
    def get(self, id):
        user = _reviewer()
        return service.get_bundle(db.session, id, user.external_id)


class SourceReviewsView:
    def put(self, id):
        user = _reviewer()
        summary, created = _commit(
            lambda: service.start_review(db.session, id, user.external_id)
        )
        return summary, 201 if created else 200


class ReviewsView:
    def get(self, id):
        _reviewer()
        return service.get_review(db.session, id)

    def patch(self, id, body):
        user = _reviewer()
        return _commit(
            lambda: service.set_state(
                db.session,
                id,
                user.external_id,
                body["state"],
                lead=is_user_admin(user),
                reason=body.get("reason"),
                note=body.get("note"),
            )
        )


class ReviewOpsView:
    def post(self, id, body):
        user = _reviewer()
        return _commit(lambda: service.post_ops(db.session, id, user.external_id, body))


class ReviewExportView:
    def get(self, id):
        _reviewer()
        return _zipped(
            lambda root: exports.export_review(db.session, id, root), f"review-{id}.zip"
        )


class ReviewExportsView:
    def post(self, body=None):
        _reviewer()
        return _zipped(
            lambda root: exports.export_bulk(db.session, root, **(body or {})),
            "review-exports.zip",
        )


class ReviewImportsView:
    def post(self, file):
        user = _lead_reviewer()
        if _size(file) > MAX_IMPORT_BYTES:
            abort_too_large(f"The file is over {MAX_IMPORT_BYTES} bytes.")
        with tempfile.TemporaryDirectory() as directory:
            layout = Path(directory) / "layout.zip"
            _spool(file, layout)
            return _commit(
                lambda: imports.import_layout(db.session, layout, user_id=user.external_id)
            )
