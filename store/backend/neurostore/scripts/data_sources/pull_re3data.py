"""re3data repositories in Neurosciences or matching MRI/PET queries -> TSV.

usage: python -I pull_re3data.py OUT.tsv
"""

import csv
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

BASE = "https://www.re3data.org/api"
LISTS = [
    "subjects[]=206 Neurosciences",
    "subjects[]=20606 Cognitive Neuroscience and Neuroimaging",
    "query=neuroimaging",
    "query=MRI",
    "query=magnetic resonance",
    "query=PET",
    "query=positron emission",
    "query=brain imaging",
]
IMAGING = re.compile(
    r"\b(?:MRI|fMRI|PET|magnetic resonance|positron|neuroimaging|brain imaging|DTI|"
    r"diffusion|connectom)\w*",
    re.I,
)
NS = {"r3d": "http://www.re3data.org/schema/2-2"}


def get(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(
                urllib.request.Request(
                    url, headers={"User-Agent": "ns-pond-consortia"}
                ),
                timeout=60,
            ) as r:
                return r.read()
        except OSError:
            time.sleep(2**attempt)
    raise RuntimeError(url)


ids = {}
for q in LISTS:
    k, v = q.split("=", 1)
    xml = ET.fromstring(
        get(f"{BASE}/beta/repositories?{urllib.parse.quote(k)}={urllib.parse.quote(v)}")
    )
    for repo in xml.iter("repository"):
        ids.setdefault(repo.findtext("id"), set()).add(q)
print(f"{len(ids)} candidate repositories", file=sys.stderr)

with open(sys.argv[1], "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter="\t")
    w.writerow(
        [
            "re3data_id",
            "name",
            "additional_names",
            "url",
            "subjects",
            "keywords",
            "imaging_terms",
            "matched_lists",
            "description",
        ]
    )
    for rid, lists in sorted(ids.items()):
        root = ET.fromstring(get(f"{BASE}/v1/repository/{rid}"))
        repo = root.find("r3d:repository", NS)

        def text(tag, repo=repo):
            return [e.text.strip() for e in repo.findall(f"r3d:{tag}", NS) if e.text]

        desc = " ".join(text("description"))
        kws = text("keyword")
        terms = sorted(
            {
                m.lower()
                for m in IMAGING.findall(
                    " ".join([desc, *kws, *text("repositoryName")])
                )
            }
        )
        w.writerow(
            [
                rid,
                "|".join(text("repositoryName")),
                "|".join(text("additionalName")),
                "|".join(text("repositoryURL")),
                "|".join(text("subject")),
                "|".join(kws),
                "|".join(terms),
                "|".join(sorted(lists)),
                re.sub(r"\s+", " ", desc)[:400],
            ]
        )
        time.sleep(0.2)
