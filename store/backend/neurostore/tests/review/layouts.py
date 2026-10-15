"""The study_schema layouts and API identities the /review tests share."""

import hashlib
import json
import zipfile
from functools import cache
from pathlib import Path

import yaml
from jose.jwt import encode
from jsonschema import Draft202012Validator

from neurostore import schemas
from neurostore.tests.study_schema_fixtures import (
    parse,
    parsed_paper,
    point,
    record,
    record_analysis,
    table_analysis,
)

REVIEWER = "user1-id"
OTHER = "user2-id"
LEAD = "admin-user-id"
TOKENS = {
    REVIEWER: encode({"sub": REVIEWER}, "abc", algorithm="HS256"),
    OTHER: encode({"sub": OTHER}, "123", algorithm="HS256"),
    LEAD: encode({"sub": LEAD}, "admin123", algorithm="HS256"),
    "newuser-id": encode({"sub": "newuser-id"}, "789", algorithm="HS256"),
}

TEXT = "Participants viewed faces. The amygdala responded at 20, -4, -18 (t = 3.5)."
OPENAPI = Path(schemas.__file__).resolve().parents[1] / "openapi" / "neurostore-openapi.yml"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


DIGEST = sha256(TEXT.encode("utf-8"))


def documents(study_id):
    """A consistent parsed paper, coordinate parse and record for ``TEXT``."""
    paper = parsed_paper(pmid=study_id)
    paper.update(text_path="text/paper.txt", text_sha256=DIGEST)
    analysis = table_analysis("t1", [1], "Faces > Houses", [point((20, -4, -18))])
    coordinate_parse = parse([analysis], pmid=study_id)
    coordinate_parse["text_sha256"] = DIGEST
    extraction = record([record_analysis("a1", analysis["key"], "Faces > Houses")])
    extraction["extraction_metadata"]["source_text_hash"] = DIGEST
    return paper, coordinate_parse, extraction


def dump(document):
    return (json.dumps(document, indent=2) + "\n").encode("utf-8")


def write_layout(root, study_id, paper=None, coordinate_parse=None, extraction=None):
    """Write one paper's files under ``root`` and return them keyed by layout path."""
    defaults = documents(study_id)
    paper = paper or defaults[0]
    coordinate_parse = coordinate_parse or defaults[1]
    extraction = extraction or defaults[2]
    files = {
        f"corpus/{study_id}/parse/parsed_paper.json": dump(paper),
        f"corpus/{study_id}/parse/coordinate_parse.json": dump(coordinate_parse),
        f"corpus/{study_id}/{paper['text_path']}": TEXT.encode("utf-8"),
        f"run/records/{study_id}.extraction.json": dump(extraction),
    }
    for relative, data in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return files


def zip_layout(files, archive, prefix=""):
    """Zip ``files`` (layout path to bytes) to ``archive``, each path under ``prefix``."""
    with zipfile.ZipFile(archive, "w") as zipped:
        for relative, data in files.items():
            zipped.writestr(prefix + relative, data)
    return archive


@cache
def spec():
    return yaml.safe_load(OPENAPI.read_text(encoding="utf-8"))


def resolved(node):
    """``node`` with each $ref inlined from components/schemas and OpenAPI 3.0's nullable
    turned into a JSON Schema null branch."""
    if isinstance(node, dict):
        if "$ref" in node:
            return resolved(spec()["components"]["schemas"][node["$ref"].rsplit("/", 1)[-1]])
        inlined = {key: resolved(value) for key, value in node.items()}
        if inlined.pop("nullable", False):
            return {"anyOf": [inlined, {"type": "null"}]}
        return inlined
    if isinstance(node, list):
        return [resolved(item) for item in node]
    return node


def assert_matches_spec(response, path, method):
    documented = spec()["paths"][path][method]["responses"][str(response.status_code)]
    if "$ref" in documented:
        documented = spec()["components"]["responses"][documented["$ref"].rsplit("/", 1)[-1]]
    schema = documented["content"]["application/json"]
    errors = [
        error.message
        for error in Draft202012Validator(resolved(schema["schema"])).iter_errors(response.json())
    ]
    assert errors == [], (method, path, response.status_code, errors)
