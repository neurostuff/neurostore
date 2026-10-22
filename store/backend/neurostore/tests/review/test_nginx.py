"""The proxy in front of the API and the review app: the import route's cap and /review/."""

import re
from pathlib import Path

import pytest
import yaml

from neurostore.paths import UPLOAD_URL_PREFIX
from neurostore.resources import body_limit

NGINX_DIR = Path(__file__).resolve().parents[4] / "nginx"
UNITS = {"": 1, "k": 1024, "m": 1024**2, "g": 1024**3}


def location(conf, prefix):
    """The directives of ``location <prefix> { ... }`` in ``conf``, in order."""
    match = re.search(rf"location\s+{re.escape(prefix)}\s*{{(.*?)}}", conf, re.S)
    assert match, f"no location {prefix}"
    return [" ".join(line.split()) for line in match.group(1).split(";") if line.strip()]


def body_size(directives):
    [value] = [d.split()[1] for d in directives if d.startswith("client_max_body_size ")]
    number, unit = re.fullmatch(r"(\d+)([kKmMgG]?)", value).groups()
    return int(number) * UNITS[unit.lower()]


@pytest.mark.parametrize("name", ["nginx.conf", "nginx.dev.conf"])
def test_the_import_location_lets_through_exactly_the_import_cap(name):
    conf = (NGINX_DIR / name).read_text()

    assert body_size(location(conf, UPLOAD_URL_PREFIX)) == body_limit.MAX_IMPORT_BYTES


@pytest.mark.parametrize("name", ["nginx.conf", "nginx.dev.conf"])
def test_the_import_location_proxies_as_the_api_location_does(name):
    conf = (NGINX_DIR / name).read_text()

    def proxied(prefix):
        return [d for d in location(conf, prefix) if not d.startswith("client_max_body_size ")]

    assert proxied(UPLOAD_URL_PREFIX) == proxied("/api")


STORE_DIR = NGINX_DIR.parent
REVIEW_DIST = "/store/review-frontend/dist/"


def test_the_review_app_is_served_from_its_build_with_a_fallback_to_its_index():
    conf = (NGINX_DIR / "nginx.conf").read_text()
    app = location(conf, "/review/")

    assert f"alias {REVIEW_DIST}" in app
    assert "try_files $uri $uri/ /review/index.html" in app
    assert f"alias {REVIEW_DIST}assets/" in location(conf, "/review/assets/")
    assert "base: '/review/'" in (STORE_DIR / "review-frontend/vite.config.ts").read_text()


def test_nginx_sees_the_review_build_through_the_neurostore_mount():
    services = yaml.safe_load((STORE_DIR / "docker-compose.yml").read_text())["services"]

    assert "neurostore" in services["store_nginx"]["volumes_from"]
    assert "./:/store" in services["neurostore"]["volumes"]
