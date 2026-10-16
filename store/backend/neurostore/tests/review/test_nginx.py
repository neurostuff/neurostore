"""The proxy in front of the API lets through what the review import route accepts."""

import re
from pathlib import Path

import pytest

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
