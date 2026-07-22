from urllib.parse import quote

from neurostore.exceptions.utils.error_helpers import abort_not_found
from neurostore.services.neurostore_studyset_releases import (
    list_release_manifests,
    load_release_manifest,
    release_archive_path,
    release_root,
)

INTERNAL_RELEASE_URI_PREFIX = "/_protected/neurostore-studyset-releases"


def x_accel_release_uri(archive_path):
    root = release_root().resolve()
    resolved = archive_path.resolve()
    try:
        relative_path = resolved.relative_to(root)
    except ValueError:
        abort_not_found("NeurostoreStudysetRelease", archive_path.name)

    return INTERNAL_RELEASE_URI_PREFIX + "/" + quote(relative_path.as_posix(), safe="/")


class NeurostoreStudysetReleasesView:
    def search(self):
        manifests = list_release_manifests()
        return {
            "metadata": {"total_count": len(manifests)},
            "results": manifests,
        }

    def get(self, version):
        manifest = load_release_manifest(version)
        if manifest is None:
            abort_not_found("NeurostoreStudysetRelease", version)
        return manifest


class DownloadView:
    def search(self, version):
        archive_path = release_archive_path(version)
        if archive_path is None:
            abort_not_found("NeurostoreStudysetRelease", version)

        headers = {
            "X-Accel-Redirect": x_accel_release_uri(archive_path),
            "Content-Type": "application/gzip",
            "Content-Disposition": f'attachment; filename="{archive_path.name}"',
        }
        if version in {"nightly", "latest"}:
            headers["Cache-Control"] = "no-cache"
            headers["X-Accel-Expires"] = "0"
        else:
            headers["Cache-Control"] = "public, max-age=31536000"
            headers["X-Accel-Expires"] = "31536000"
        return None, 200, headers
