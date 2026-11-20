"""Read and write study_schema's file layout, for one paper or a directory or zip of many."""

import hashlib
import json
import zipfile
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from pydantic import ValidationError

from neurostore.review.errors import Unprocessable
from neurostore.study_schema_tools import expected_key, schema_errors, version_mismatch


class LayoutError(Unprocessable):
    """A file that is not a study_schema layout; each problem is a field error on ``file``."""

    def __init__(self, problems):
        problems = list(problems)
        errors = [
            {
                "field": "file",
                "code": "INVALID_LAYOUT",
                "message": "invalid value for file",
                "context": {"provided": problem},
            }
            for problem in problems
        ]
        super().__init__("; ".join(problems), problems, errors=errors)


@dataclass(frozen=True)
class Paper:
    study_id: str
    parsed_paper: dict
    coordinate_parse: dict
    record: dict
    text: str
    raw: dict[str, bytes] | None = None


def _record_path(study_id):
    return f"run/records/{study_id}.extraction.json"


def _document_paths(study_id):
    """The paper's JSON documents, relative to the layout root, keyed by Paper field name."""
    return {
        "parsed_paper": f"corpus/{study_id}/parse/parsed_paper.json",
        "coordinate_parse": f"corpus/{study_id}/parse/coordinate_parse.json",
        "record": _record_path(study_id),
    }


def _text_path(study_id, parsed_paper):
    return f"corpus/{study_id}/{PurePosixPath(parsed_paper['text_path'])}"


def _escapes_paper(text_path):
    path = PurePosixPath(text_path)
    return path.is_absolute() or ".." in path.parts


def _provenance_path(study_id):
    return f"run/provenance/{study_id}.json"


def _revision_path(study_id):
    return f"run/revisions/{study_id}.coordinate_parse.json"


def _ops_path(study_id):
    return f"review/{study_id}.ops.jsonl"


def _read(root, relatives):
    missing = [relative for relative in relatives if not (root / relative).is_file()]
    if missing:
        raise LayoutError([f"missing {relative}" for relative in missing])
    return {relative: (root / relative).read_bytes() for relative in relatives}


def _parse_documents(paths, raw):
    documents, problems = {}, []
    for name, relative in paths.items():
        try:
            documents[name] = json.loads(raw[relative])
        except ValueError as error:
            problems.append(f"{relative} is not JSON: {error}")
            continue
        if not isinstance(documents[name], dict):
            problems.append(f"{relative} is not a JSON object")
    if problems:
        raise LayoutError(problems)
    text_path = documents["parsed_paper"].get("text_path")
    if not isinstance(text_path, str):
        raise LayoutError([f"{paths['parsed_paper']} has no text_path"])
    if _escapes_paper(text_path):
        raise LayoutError(
            [f"{paths['parsed_paper']} text_path {text_path!r} is absolute or contains '..'"]
        )
    return documents


def paper_from_documents(study_id, parsed_paper, coordinate_parse, record, text) -> Paper:
    return Paper(
        study_id=study_id,
        parsed_paper=parsed_paper,
        coordinate_parse=coordinate_parse,
        record=record,
        text=text,
    )


def read_provenance(root: Path | zipfile.Path, study_id: str) -> dict | None:
    """The provenance wrapper beside a paper's record, or None when the layout has none."""
    relative = _provenance_path(study_id)
    if not (root / relative).is_file():
        return None
    raw = _read(root, [relative])
    try:
        document = json.loads(raw[relative])
    except ValueError as error:
        raise LayoutError([f"{relative} is not JSON: {error}"]) from error
    if not isinstance(document, dict):
        raise LayoutError([f"{relative} is not a JSON object"])
    return document


def _read_text(root, study_id, parsed_paper, raw):
    text_path = _text_path(study_id, parsed_paper)
    raw.update(_read(root, [text_path]))
    try:
        return raw[text_path].decode("utf-8")
    except UnicodeDecodeError as error:
        raise LayoutError([f"{text_path} is not UTF-8 text: {error}"]) from error


def _read_documents(root, study_id, names=None):
    """``(documents, text, raw)``: the paper's JSON documents ``names``, else all of them, and
    the text its parsed paper names."""
    paths = {
        name: path
        for name, path in _document_paths(study_id).items()
        if names is None or name in names
    }
    raw = _read(root, list(paths.values()))
    documents = _parse_documents(paths, raw)
    return documents, _read_text(root, study_id, documents["parsed_paper"], raw), raw


def read_paper(root: Path | zipfile.Path, study_id: str) -> Paper:
    documents, text, raw = _read_documents(root, study_id)
    return Paper(
        study_id=study_id,
        parsed_paper=documents["parsed_paper"],
        coordinate_parse=documents["coordinate_parse"],
        record=documents["record"],
        text=text,
        raw=raw,
    )


def read_parsed_paper(root: Path | zipfile.Path, study_id: str) -> tuple[dict, str]:
    """A paper's parsed paper and the text it names, without its parse or record."""
    documents, text, _ = _read_documents(root, study_id, ("parsed_paper",))
    return documents["parsed_paper"], text


def _dotted(path):
    return ".".join(str(part) for part in path)


def _schema_problems(label, name, document):
    problems = [
        f"{label} at {_dotted(e.path) or '(root)'}: {e.message}"
        for e in schema_errors(name, document)
    ]
    mismatch = version_mismatch(name, document)
    if mismatch:
        problems.append(
            f"{label} at header.schema_version: is {mismatch[0]}, not the pinned {mismatch[1]}"
        )
    return problems


def _hash_problems(paper):
    text_path = _text_path(paper.study_id, paper.parsed_paper)
    actual = hashlib.sha256(paper.text.encode("utf-8")).hexdigest()
    declared = {
        "parsed_paper text_sha256": paper.parsed_paper.get("text_sha256"),
        "coordinate_parse text_sha256": paper.coordinate_parse.get("text_sha256"),
    }
    source_text_hash = (paper.record.get("extraction_metadata") or {}).get("source_text_hash")
    if source_text_hash is not None:
        declared["record extraction_metadata.source_text_hash"] = source_text_hash
    return [
        f"{field} {value} != sha256 of {text_path} {actual}"
        for field, value in declared.items()
        if value != actual
    ]


def _nodes(value, path=()):
    yield path, value
    if isinstance(value, dict):
        children = value.items()
    elif isinstance(value, list):
        children = enumerate(value)
    else:
        return
    for key, child in children:
        yield from _nodes(child, (*path, key))


def _is_span_path(path):
    """Whether path ends in ...evidence.sets.<i>.spans.<j>, the shape of an evidence span."""
    return (
        len(path) >= 5
        and path[-5:-3] == ("evidence", "sets")
        and path[-2] == "spans"
        and isinstance(path[-3], int)
        and isinstance(path[-1], int)
    )


def _span_problems(record, text):
    problems = []
    for path, span in _nodes(record):
        if not (_is_span_path(path) and isinstance(span, dict)):
            continue
        start, end, quote = span.get("start_char"), span.get("end_char"), span.get("text")
        if not (isinstance(start, int) and isinstance(end, int) and isinstance(quote, str)):
            continue
        where = f"record {_dotted(path)}"
        if not 0 <= start < end <= len(text):
            problems.append(
                f"{where}: span [{start}, {end}) is not within the text of {len(text)} characters"
            )
        elif text[start:end] != quote:
            problems.append(f"{where}: text[{start}:{end}] is {text[start:end]!r}, not {quote!r}")
    return problems


def _key_problems(coordinate_parse):
    problems = []
    for i, analysis in enumerate(coordinate_parse.get("analyses") or ()):
        try:
            expected = expected_key(analysis)
        except ValidationError:
            continue
        key = analysis.get("key")
        if key != expected:
            problems.append(f"coordinate_parse analyses.{i}.key {key} != {expected}")
    return problems


def check_paper(paper: Paper) -> list[str]:
    return [
        *_schema_problems("parsed_paper", "parsed-paper", paper.parsed_paper),
        *_schema_problems("coordinate_parse", "coordinate-parse", paper.coordinate_parse),
        *_schema_problems("record", "extraction-record", paper.record),
        *_hash_problems(paper),
        *_span_problems(paper.record, paper.text),
        *_key_problems(paper.coordinate_parse),
    ]


def _layout_root(source, root):
    if (root / "corpus").is_dir():
        return root
    tops = [child for child in root.iterdir() if (child / "corpus").is_dir()]
    if len(tops) != 1:
        raise LayoutError(
            [f"{source} has no corpus/ at its root or under exactly one top folder"]
        )
    return tops[0]


@contextmanager
def open_layout(source: Path):
    """The root folder of a layout directory or zip, open for the block."""
    if source.is_dir():
        if not (source / "corpus").is_dir():
            raise LayoutError([f"{source} has no corpus/ at its root"])
        yield source
    elif zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            yield _layout_root(source, zipfile.Path(archive))
    else:
        raise LayoutError([f"{source} is neither a layout directory nor a zip"])


def _ids_with(root, path_of):
    """The ids of the papers under ``root`` that have the file ``path_of`` names, sorted."""
    return sorted(
        child.name
        for child in (root / "corpus").iterdir()
        if child.is_dir() and (root / path_of(child.name)).is_file()
    )


def study_ids(root) -> list[str]:
    """The ids of the papers under ``root`` that have a record, sorted."""
    return _ids_with(root, _record_path)


def parsed_paper_ids(root) -> list[str]:
    """The ids of the papers under ``root`` that have a parsed paper, sorted."""
    return _ids_with(root, lambda study_id: _document_paths(study_id)["parsed_paper"])


def read_layout(source: Path) -> list[Paper]:
    with open_layout(source) as root:
        return [read_paper(root, study_id) for study_id in study_ids(root)]


def dumped(document):
    return (json.dumps(document, indent=1, ensure_ascii=False) + "\n").encode("utf-8")


def write_export(
    out: Path, paper: Paper, record: dict, coordinate_revision: dict | None, ops: list[dict] | None
) -> str:
    """Write one paper's layout under ``out``; returns the record's path."""
    study_id = paper.study_id
    paths = _document_paths(study_id)
    files = {
        paths["parsed_paper"]: dumped(paper.parsed_paper),
        paths["coordinate_parse"]: dumped(paper.coordinate_parse),
        paths["record"]: dumped(record),
        _text_path(study_id, paper.parsed_paper): paper.text.encode("utf-8"),
    }
    if coordinate_revision is not None:
        files[_revision_path(study_id)] = dumped(coordinate_revision)
    if ops is not None:
        files[_ops_path(study_id)] = "".join(
            json.dumps(op, ensure_ascii=False) + "\n" for op in ops
        ).encode("utf-8")
    for relative, data in files.items():
        path = out / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return paths["record"]
