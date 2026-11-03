"""EBRAINS KG dataset versions that use MRI or PET, plus all projects and consortia, to TSVs.

usage: python -I ebrains_imaging.py KG_DIR

KG_DIR holds /v3/instances pages named TYPE_FROM.json (DatasetVersion, Dataset, Project, Consortium, Technique,
AnalysisTechnique). Writes KG_DIR/imaging_datasets.tsv and KG_DIR/projects.tsv.
"""

import csv
import glob
import os
import re
import sys

P = "https://openminds.om-i.org/props/"
IMAGING = re.compile(
    r"magnetic resonance|\bMRI\b|\bfMRI\b|positron emission|\bPET\b|diffusion|tractograph|"
    r"\bBOLD\b|morphometr|arterial spin",
    re.I,
)


def load(kg, ty):
    import json

    out = []
    for path in sorted(glob.glob(os.path.join(kg, f"{ty}_*.json"))):
        with open(path, encoding="utf-8") as f:
            out += json.load(f)["data"]
    return out


def ids(v):
    v = v if isinstance(v, list) else [v] if v else []
    return [x["@id"] for x in v if isinstance(x, dict)]


def main():
    kg = sys.argv[1]
    term = {
        t["@id"]: t.get(P + "name", "")
        for ty in ("Technique", "AnalysisTechnique")
        for t in load(kg, ty)
    }
    parent = {}
    for d in load(kg, "Dataset"):
        for v in ids(d.get(P + "hasVersion")):
            parent[v] = d
    rows = []
    for v in load(kg, "DatasetVersion"):
        techs = [term.get(i, "") for i in ids(v.get(P + "technique"))]
        text = " ".join([*techs, v.get(P + "description") or ""])
        if not IMAGING.search(" ".join(techs)) and not IMAGING.search(text):
            continue
        d = parent.get(v["@id"], {})
        rows.append(
            {
                "dataset": d.get(P + "fullName") or v.get(P + "fullName") or "",
                "short": d.get(P + "shortName") or v.get(P + "shortName") or "",
                "version": v.get(P + "versionIdentifier", ""),
                "techniques": "|".join(t for t in techs if t),
                "technique_match": "yes" if IMAGING.search(" ".join(techs)) else "",
                "homepage": v.get(P + "homepage") or "",
                "id": v["@id"],
                "description": re.sub(r"\s+", " ", v.get(P + "description") or "")[
                    :600
                ],
            }
        )
    with open(
        os.path.join(kg, "imaging_datasets.tsv"), "w", newline="", encoding="utf-8"
    ) as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]), delimiter="\t")
        w.writeheader()
        w.writerows(rows)
    projects = [
        {
            "type": ty,
            "name": p.get(P + "fullName") or p.get(P + "name") or "",
            "short": p.get(P + "shortName") or "",
            "homepage": p.get(P + "homepage") or "",
            "datasets": len(ids(p.get(P + "hasPart"))),
            "description": re.sub(r"\s+", " ", p.get(P + "description") or "")[:600],
        }
        for ty in ("Project", "Consortium")
        for p in load(kg, ty)
    ]
    with open(os.path.join(kg, "projects.tsv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(projects[0]), delimiter="\t")
        w.writeheader()
        w.writerows(projects)
    print(
        f"{len(rows)} imaging dataset versions ({sum(bool(r['technique_match']) for r in rows)} by technique), "
        f"{len(projects)} projects/consortia",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
