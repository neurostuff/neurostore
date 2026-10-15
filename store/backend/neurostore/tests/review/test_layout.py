import copy
import dataclasses
import json

import pytest

from neurostore.review.layout import (
    LayoutError,
    Paper,
    check_paper,
    read_layout,
    read_paper,
    write_export,
)
from neurostore.tests.review.layouts import (
    DIGEST,
    TEXT,
    documents,
    dump,
    write_layout,
    zip_layout,
)
from neurostore.tests.study_schema_fixtures import extracted


def test_read_paper_returns_documents_text_and_raw_bytes(tmp_path):
    files = write_layout(tmp_path, "s1")

    paper = read_paper(tmp_path, "s1")

    expected = documents("s1")
    assert paper.study_id == "s1"
    assert (paper.parsed_paper, paper.coordinate_parse, paper.record) == expected
    assert paper.text == TEXT
    assert paper.raw == files


def test_paper_is_frozen(tmp_path):
    write_layout(tmp_path, "s1")
    paper = read_paper(tmp_path, "s1")

    assert [field.name for field in dataclasses.fields(Paper)] == [
        "study_id",
        "parsed_paper",
        "coordinate_parse",
        "record",
        "text",
        "raw",
    ]
    with pytest.raises(dataclasses.FrozenInstanceError):
        paper.text = "changed"


@pytest.mark.parametrize(
    "missing",
    [
        "corpus/s1/parse/parsed_paper.json",
        "corpus/s1/parse/coordinate_parse.json",
        "corpus/s1/text/paper.txt",
        "run/records/s1.extraction.json",
    ],
)
def test_read_paper_missing_file_raises_layout_error_naming_it(tmp_path, missing):
    write_layout(tmp_path, "s1")
    (tmp_path / missing).unlink()

    with pytest.raises(LayoutError) as raised:
        read_paper(tmp_path, "s1")

    assert any(missing in problem for problem in raised.value.problems)


@pytest.mark.parametrize(
    "relative, data, problem",
    [
        ("corpus/s1/parse/parsed_paper.json", b"{", "corpus/s1/parse/parsed_paper.json is not"),
        ("run/records/s1.extraction.json", b"[]", "run/records/s1.extraction.json is not"),
        ("corpus/s1/text/paper.txt", b"caf\xe9", "corpus/s1/text/paper.txt is not UTF-8"),
    ],
)
def test_read_paper_unreadable_file_raises_layout_error_naming_it(
    tmp_path, relative, data, problem
):
    write_layout(tmp_path, "s1")
    (tmp_path / relative).write_bytes(data)

    with pytest.raises(LayoutError) as raised:
        read_paper(tmp_path, "s1")

    assert [p for p in raised.value.problems if p.startswith(problem)]


def write_parsed_paper(root, study_id, **fields):
    (root / f"corpus/{study_id}/parse/parsed_paper.json").write_bytes(
        dump({**documents(study_id)[0], **fields})
    )


def test_read_paper_without_text_path_raises_layout_error(tmp_path):
    write_layout(tmp_path, "s1")
    paper = {key: value for key, value in documents("s1")[0].items() if key != "text_path"}
    (tmp_path / "corpus/s1/parse/parsed_paper.json").write_bytes(dump(paper))

    with pytest.raises(LayoutError) as raised:
        read_paper(tmp_path, "s1")

    assert raised.value.problems == ["corpus/s1/parse/parsed_paper.json has no text_path"]


def test_read_paper_normalises_text_path_in_raw_keys(tmp_path):
    files = write_layout(tmp_path, "s1")
    write_parsed_paper(tmp_path, "s1", text_path="./text/paper.txt")

    paper = read_paper(tmp_path, "s1")

    assert paper.raw.keys() == files.keys()
    assert paper.text == TEXT


@pytest.mark.parametrize(
    "text_path", ["../../secret.txt", "text/../../../secret.txt", "/secret.txt"]
)
def test_read_paper_refuses_a_text_path_outside_the_paper(tmp_path, text_path):
    root = tmp_path / "layout"
    write_layout(root, "s1")
    (root / "secret.txt").write_bytes(TEXT.encode("utf-8"))
    write_parsed_paper(root, "s1", text_path=text_path)

    with pytest.raises(LayoutError) as raised:
        read_paper(root, "s1")

    assert [p for p in raised.value.problems if "text_path" in p and text_path in p]


@pytest.mark.parametrize("text_path", ["../../secret.txt", "/secret.txt"])
def test_read_layout_refuses_a_zip_whose_text_path_leaves_the_paper(tmp_path, text_path):
    files = write_layout(tmp_path / "tree", "s1")
    files["corpus/s1/parse/parsed_paper.json"] = dump(
        {**documents("s1")[0], "text_path": text_path}
    )
    archive = zip_layout(files, tmp_path / "layout.zip")

    with pytest.raises(LayoutError) as raised:
        read_layout(archive)

    assert [p for p in raised.value.problems if "text_path" in p and text_path in p]


def test_read_layout_refuses_a_directory_whose_only_child_holds_the_corpus(tmp_path):
    write_layout(tmp_path / "bundle", "s1")

    with pytest.raises(LayoutError) as raised:
        read_layout(tmp_path)

    assert [p for p in raised.value.problems if str(tmp_path) in p]


def test_check_paper_reports_parsed_paper_text_hash_not_matching_the_text(tmp_path):
    paper = documents("s1")[0]
    paper["text_sha256"] = WRONG

    problems = checked(tmp_path, paper=paper)

    assert problems == [
        f"parsed_paper text_sha256 {WRONG} != sha256 of corpus/s1/text/paper.txt {DIGEST}"
    ]


def checked(tmp_path, **overrides):
    write_layout(tmp_path, "s1", **overrides)
    return check_paper(read_paper(tmp_path, "s1"))


def test_check_paper_consistent_paper_has_no_problems(tmp_path):
    assert checked(tmp_path) == []


@pytest.mark.parametrize(
    "schema, document, field",
    [
        ("parsed_paper", "paper", "is_meta_analysis"),
        ("coordinate_parse", "coordinate_parse", "parse_id"),
        ("record", "extraction", "local_id"),
    ],
)
def test_check_paper_reports_schema_errors(tmp_path, schema, document, field):
    paper, coordinate_parse, extraction = documents("s1")
    broken = dict(paper=paper, coordinate_parse=coordinate_parse, extraction=extraction)
    del broken[document][field]

    problems = checked(tmp_path, **broken)

    assert [p for p in problems if p.startswith(f"{schema} at ") and field in p]


WRONG = "f" * 64


def test_check_paper_reports_each_hash_not_matching_the_text(tmp_path):
    paper, coordinate_parse, extraction = documents("s1")
    paper["text_sha256"] = WRONG
    coordinate_parse["text_sha256"] = WRONG
    extraction["extraction_metadata"]["source_text_hash"] = WRONG

    problems = checked(
        tmp_path, paper=paper, coordinate_parse=coordinate_parse, extraction=extraction
    )

    assert problems == [
        f"{field} {WRONG} != sha256 of corpus/s1/text/paper.txt {DIGEST}"
        for field in (
            "parsed_paper text_sha256",
            "coordinate_parse text_sha256",
            "record extraction_metadata.source_text_hash",
        )
    ]


def test_check_paper_reports_coordinate_parse_for_another_text(tmp_path):
    coordinate_parse = documents("s1")[1]
    coordinate_parse["text_sha256"] = WRONG

    problems = checked(tmp_path, coordinate_parse=coordinate_parse)

    assert problems == [
        f"coordinate_parse text_sha256 {WRONG} != sha256 of corpus/s1/text/paper.txt {DIGEST}"
    ]


def test_check_paper_reports_record_for_another_text(tmp_path):
    extraction = documents("s1")[2]
    extraction["extraction_metadata"]["source_text_hash"] = WRONG

    problems = checked(tmp_path, extraction=extraction)

    assert problems == [
        f"record extraction_metadata.source_text_hash {WRONG} != sha256 of "
        f"corpus/s1/text/paper.txt {DIGEST}"
    ]


@pytest.mark.parametrize("null", [False, True])
def test_check_paper_accepts_record_without_source_text_hash(tmp_path, null):
    extraction = documents("s1")[2]
    if null:
        extraction["extraction_metadata"]["source_text_hash"] = None
    else:
        del extraction["extraction_metadata"]["source_text_hash"]

    assert checked(tmp_path, extraction=extraction) == []


def with_span(extraction, start, end, text, at=("analyses", 0, "name")):
    field = extraction
    for part in at:
        field = field[part]
    field["evidence"] = {
        "status": "present",
        "sets": [{"spans": [{"text": text, "start_char": start, "end_char": end}]}],
    }
    return extraction


SPAN_PATH = "analyses.0.name.evidence.sets.0.spans.0"
END = len(TEXT)


@pytest.mark.parametrize(
    "start, end",
    [(TEXT.index("amygdala"), TEXT.index("amygdala") + 8), (END - 5, END), (0, END)],
)
def test_check_paper_accepts_spans_quoting_the_text(tmp_path, start, end):
    extraction = with_span(documents("s1")[2], start, end, TEXT[start:end])

    assert checked(tmp_path, extraction=extraction) == []


@pytest.mark.parametrize(
    "start, end, quote, problem",
    [
        (5, 5, "", f"span [5, 5) is not within the text of {END} characters"),
        (9, 4, "x", f"span [9, 4) is not within the text of {END} characters"),
        (
            END - 2,
            END + 1,
            TEXT[-2:],
            f"span [{END - 2}, {END + 1}) is not within the text of {END} characters",
        ),
        (-1, 3, "Pa", f"span [-1, 3) is not within the text of {END} characters"),
        (0, 12, "Participants viewed", "text[0:12] is 'Participants', not 'Participants viewed'"),
    ],
)
def test_check_paper_reports_spans_off_the_text_by_their_path(
    tmp_path, start, end, quote, problem
):
    extraction = with_span(documents("s1")[2], start, end, quote)

    problems = checked(tmp_path, extraction=extraction)

    assert [p for p in problems if p.startswith(f"record {SPAN_PATH}")] == [
        f"record {SPAN_PATH}: {problem}"
    ]


def test_check_paper_checks_spans_anywhere_in_the_record(tmp_path):
    extraction = documents("s1")[2]
    extraction["coordinate_sets"] = [{"local_id": "k1", "role": extracted("result")}]
    with_span(extraction, 0, 12, "participants", at=("coordinate_sets", 0, "role"))

    problems = checked(tmp_path, extraction=extraction)

    assert problems == [
        "record coordinate_sets.0.role.evidence.sets.0.spans.0: "
        "text[0:12] is 'Participants', not 'participants'"
    ]


@pytest.mark.parametrize(
    "evidence",
    [
        {"status": "present", "sets": ["not a set"]},
        {"status": "present", "sets": [{"spans": [7]}]},
        {"status": "present", "sets": [{"spans": [{"text": "P", "start_char": "0"}]}]},
    ],
)
def test_check_paper_leaves_malformed_spans_to_the_schema(tmp_path, evidence):
    extraction = documents("s1")[2]
    extraction["analyses"][0]["name"]["evidence"] = evidence

    problems = checked(tmp_path, extraction=extraction)

    assert problems
    assert all(p.startswith("record at ") for p in problems)


def test_check_paper_reports_analysis_keys_its_content_does_not_give(tmp_path):
    _, coordinate_parse, _ = documents("s1")
    expected = coordinate_parse["analyses"][0]["key"]
    coordinate_parse["analyses"][0]["key"] = "analysis#0000000000000000"

    problems = checked(tmp_path, coordinate_parse=coordinate_parse)

    assert problems == [
        f"coordinate_parse analyses.0.key analysis#0000000000000000 != {expected}"
    ]


def test_check_paper_leaves_malformed_analyses_to_the_schema(tmp_path):
    _, coordinate_parse, _ = documents("s1")
    coordinate_parse["analyses"][0]["points"] = "none"

    problems = checked(tmp_path, coordinate_parse=coordinate_parse)

    assert problems
    assert all(p.startswith("coordinate_parse at ") for p in problems)


def test_read_layout_reads_each_paper_with_a_record_in_id_order(tmp_path):
    for study_id in ("s2", "s1", "s3"):
        write_layout(tmp_path, study_id)
    (tmp_path / "run/records/s3.extraction.json").unlink()

    papers = read_layout(tmp_path)

    assert papers == [read_paper(tmp_path, "s1"), read_paper(tmp_path, "s2")]


@pytest.mark.parametrize("top", ["", "bundle/"])
def test_read_layout_reads_a_zip_at_its_root_or_under_one_folder(tmp_path, top):
    files = {**write_layout(tmp_path / "tree", "s1"), **write_layout(tmp_path / "tree", "s2")}
    archive = zip_layout(files, tmp_path / "layout.zip", prefix=top)

    papers = read_layout(archive)

    assert papers == read_layout(tmp_path / "tree")
    assert [paper.study_id for paper in papers] == ["s1", "s2"]


def test_read_layout_skips_macos_metadata_beside_the_top_folder(tmp_path):
    files = write_layout(tmp_path / "tree", "s1")
    archived = {f"bundle/{relative}": data for relative, data in files.items()}
    archived.update({f"__MACOSX/bundle/{relative}": b"" for relative in files})
    archive = zip_layout(archived, tmp_path / "layout.zip")

    assert read_layout(archive) == read_layout(tmp_path / "tree")


@pytest.mark.parametrize("prefixes", [["a/inner/"], ["a/", "b/"]])
def test_read_layout_zip_without_one_corpus_raises_layout_error(tmp_path, prefixes):
    files = write_layout(tmp_path / "tree", "s1")
    archive = zip_layout(
        {prefix + relative: data for prefix in prefixes for relative, data in files.items()},
        tmp_path / "layout.zip",
    )

    with pytest.raises(LayoutError) as raised:
        read_layout(archive)

    assert [p for p in raised.value.problems if str(archive) in p]


@pytest.mark.parametrize("make", ["empty directory", "missing path", "not a zip"])
def test_read_layout_source_that_is_not_a_layout_raises_layout_error(tmp_path, make):
    source = tmp_path / "source"
    if make == "empty directory":
        source.mkdir()
    elif make == "not a zip":
        source.write_bytes(b"plain text")

    with pytest.raises(LayoutError) as raised:
        read_layout(source)

    assert [p for p in raised.value.problems if str(source) in p]


def exported_files(out):
    return {
        path.relative_to(out).as_posix(): path.read_bytes()
        for path in out.rglob("*")
        if path.is_file()
    }


def test_write_export_writes_unchanged_documents_as_imported_bytes(tmp_path):
    files = write_layout(tmp_path / "in", "s1")
    paper = read_paper(tmp_path / "in", "s1")

    write_export(tmp_path / "out", paper, copy.deepcopy(paper.record), None, [])

    assert exported_files(tmp_path / "out") == {**files, "review/s1.ops.jsonl": b""}


def test_write_export_writes_changed_record_revision_and_ops(tmp_path):
    write_layout(tmp_path / "in", "s1")
    paper = read_paper(tmp_path / "in", "s1")
    changed = {**paper.record, "local_id": "étude-1"}
    revision = {**paper.coordinate_parse, "revision_of": paper.coordinate_parse["parse_id"]}
    ops = [{"op": "accept", "path": "analyses.0"}, {"op": "edit", "value": "ü"}]

    write_export(tmp_path / "out", paper, changed, revision, ops)

    out = tmp_path / "out"
    expected = json.dumps(changed, indent=1, ensure_ascii=False) + "\n"
    assert (out / "run/records/s1.extraction.json").read_text("utf-8") == expected
    assert (out / "run/revisions/s1.coordinate_parse.json").read_text("utf-8") == (
        json.dumps(revision, indent=1, ensure_ascii=False) + "\n"
    )
    lines = (out / "review/s1.ops.jsonl").read_text("utf-8").splitlines()
    assert [json.loads(line) for line in lines] == ops


def test_reading_back_an_unchanged_export_gives_the_same_paper(tmp_path):
    write_layout(tmp_path / "in", "s1")
    paper = read_paper(tmp_path / "in", "s1")

    write_export(tmp_path / "out", paper, copy.deepcopy(paper.record), None, [])

    [exported] = read_layout(tmp_path / "out")
    assert exported == paper
