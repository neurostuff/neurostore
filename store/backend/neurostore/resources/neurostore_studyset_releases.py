from flask import send_file

from neurostore.exceptions.utils.error_helpers import abort_not_found
from neurostore.services.neurostore_studyset_releases import (
    list_release_manifests,
    load_release_manifest,
    release_archive_path,
)


def search():
    manifests = list_release_manifests()
    return {
        "metadata": {"total_count": len(manifests)},
        "results": manifests,
    }


def get(version):
    manifest = load_release_manifest(version)
    if manifest is None:
        abort_not_found("NeurostoreStudysetRelease", version)
    return manifest


def download(version):
    archive_path = release_archive_path(version)
    if archive_path is None:
        abort_not_found("NeurostoreStudysetRelease", version)
    return send_file(
        archive_path,
        mimetype="application/gzip",
        as_attachment=True,
        download_name=archive_path.name,
        max_age=0 if version in {"nightly", "latest"} else 31536000,
    )
