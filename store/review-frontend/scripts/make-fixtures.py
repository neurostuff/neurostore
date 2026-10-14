"""Write review bundles for converted papers, for the review app's fixtures.

    python scripts/make-fixtures.py <layout dir> <out dir> [<paper id>...]

It imports the backend's entity index, so run it in the backend container, from store/:

    docker compose run --rm --no-deps -v <layout dir>:/layout:ro neurostore \
        python /store/review-frontend/scripts/make-fixtures.py /layout /store/review-frontend/fixtures

The layout's paths are the ones store/backend/neurostore/review/layout.py reads. Each paper
(every record in the layout when no id is given) becomes <out>/<id>.bundle.json, and
<out>/index.json lists every bundle in <out>.
"""

import argparse
import hashlib
import json
from pathlib import Path

from neurostore.review.entities import index_rows


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def slot_value(slot):
    return slot.get("value") if isinstance(slot, dict) else slot


def hidden_analyses(record, coordinate_parse):
    keys = {analysis.get("key") for analysis in coordinate_parse.get("analyses", [])}
    return [
        analysis["local_id"]
        for analysis in record.get("analyses", [])
        if slot_value(analysis.get("source_table_analysis")) not in keys
    ]


def make_bundle(layout, paper_id):
    paper_dir = layout / "corpus" / paper_id
    parsed_paper = read_json(paper_dir / "parse" / "parsed_paper.json")
    coordinate_parse = read_json(paper_dir / "parse" / "coordinate_parse.json")
    record = read_json(layout / "run" / "records" / f"{paper_id}.extraction.json")
    raw = (paper_dir / parsed_paper["text_path"]).read_bytes()
    header = parsed_paper.get("header", {})
    metadata = record.get("extraction_metadata", {})
    return {
        "source": {
            "id": paper_id,
            "base_study_id": header.get("identifiers", {}).get("neurostore_base_study_id") or paper_id,
            "label": parsed_paper.get("bibliography", {}).get("title") or paper_id,
            "origin": "upload",
            "text_sha256": hashlib.sha256(raw).hexdigest(),
            "schema_versions": {
                "paper_parse": header.get("schema_version", ""),
                "extraction": metadata.get("schema_version", ""),
            },
        },
        "text": raw.decode("utf-8"),
        "parsed_paper": parsed_paper,
        "coordinate_parse": coordinate_parse,
        "record": record,
        "coordinate_revision": None,
        "review": None,
        "ops": [],
        "entities": index_rows(record),
        "hidden": {"analyses": hidden_analyses(record, coordinate_parse), "entities": []},
        "reviewers": [],
    }


def write_index(out):
    entries = []
    for path in sorted(out.glob("*.bundle.json")):
        source = read_json(path)["source"]
        entries.append({"id": source["id"], "label": source["label"]})
    (out / "index.json").write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("layout", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("ids", nargs="*")
    args = parser.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)
    records = sorted((args.layout / "run" / "records").glob("*.extraction.json"))
    for paper_id in args.ids or [path.name.removesuffix(".extraction.json") for path in records]:
        bundle = make_bundle(args.layout, paper_id)
        with open(args.out / f"{paper_id}.bundle.json", "w", encoding="utf-8") as f:
            json.dump(bundle, f, ensure_ascii=False)
    write_index(args.out)


if __name__ == "__main__":
    main()
