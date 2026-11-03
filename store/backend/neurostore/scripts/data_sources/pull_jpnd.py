"""JPND Global Cohort Portal cohorts (WordPress posts in the "cohorts" category) to a TSV.

usage: python -I pull_jpnd.py OUT.tsv PAGE.json [PAGE.json ...]

Pages come from https://neurodegenerationresearch.eu/wp-json/wp/v2/posts?categories=285&per_page=100&page=N
"""

import csv
import html
import json
import re
import sys

FIELDS = ["name", "acronym", "countries", "types", "brain_imaging", "website", "link"]


def field(lines, label):
    for line in lines:
        if line.lower().startswith(label.lower() + " "):
            return line[len(label) :].strip()
    return ""


def parse(post):
    body = re.sub(r"<br\s*/?>|</p>", "\n", post["content"]["rendered"])
    body = html.unescape(re.sub(r"<[^>]+>", "", body))
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in body.split("\n")]
    site = re.search(r'website\s*<a href="([^"]+)"', post["content"]["rendered"])
    return {
        "name": html.unescape(post["title"]["rendered"]).strip(),
        "acronym": field(lines, "cohort acronym"),
        "countries": field(lines, "Countries"),
        "types": field(lines, "Types"),
        "brain_imaging": field(lines, "Brain imaging"),
        "website": site.group(1) if site else "",
        "link": post["link"],
    }


def main():
    out, pages = sys.argv[1], sys.argv[2:]
    rows = []
    for page in pages:
        with open(page, encoding="utf-8") as f:
            rows += [parse(p) for p in json.load(f)]
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, delimiter="\t")
        w.writeheader()
        w.writerows(rows)
    print(
        f"{len(rows)} cohorts, {sum(bool(r['brain_imaging']) for r in rows)} with brain imaging",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
