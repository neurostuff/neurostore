"""Sample/site/cohort tables from ENIGMA papers (JATS full text and supplementary docx/xlsx/pdf), one row per cell
in the column that names the samples.

usage: python -I enigma_tables.py EPMC_DIR OUT.tsv

EPMC_DIR is the output of fetch_enigma_epmc.py (papers.tsv, xml/, suppl/).
"""

import csv
import io
import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile

# a header cell naming the column of samples
NAME_HEADER = re.compile(
    r"^\s*(?:sites?|samples?|cohorts?|stud(?:y|ies)|datasets?|data ?sets?|centers?|centres?|"
    r"sites?/samples?|samples?/sites?|cohort name|site name|sample name|study name|"
    r"(?:site|sample|cohort|study) (?:id|name|abbreviation|acronym))\s*[:*†‡§a-z¹²³]?\s*$",
    re.I,
)
# the table also has to report participants, which separates sample tables from results tables
COUNT_HEADER = re.compile(
    r"\b(?:N|n|total|cases?|controls?|patients?|HC|subjects|participants|age|sex|"
    r"female|male|scanner|field strength)\b",
    re.I,
)
CAPTION = re.compile(
    r"\b(?:sites?|samples?|cohorts?|demographic|participating)\b", re.I
)
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
S = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
FIELDS = ["pmcid", "pmid", "year", "title", "source", "table", "header", "cell", "row"]


def text(el):
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def name_column(rows):
    """(header row index, column index) of the sample-name column, or None."""
    for hi, header in enumerate(rows[:3]):
        for ci, cell in enumerate(header):
            if NAME_HEADER.match(cell) and any(
                COUNT_HEADER.search(c) for c in header if c is not cell
            ):
                return hi, ci
    return None


def cells(rows, caption=""):
    """Sample names from a table given as a list of rows of cell strings."""
    found = name_column(rows)
    if found is None:
        # tables captioned as sample tables often leave the first header cell empty
        if not (
            CAPTION.search(caption)
            and rows
            and any(COUNT_HEADER.search(c) for c in rows[0][1:])
        ):
            return None, []
        found = (0, 0)
    hi, ci = found
    out = []
    for row in rows[hi + 1 :]:
        if ci < len(row) and row[ci]:
            out.append((row[ci], " | ".join(row)[:300]))
    return rows[hi][ci] if ci < len(rows[hi]) else "", out


def jats_tables(path):
    root = ET.parse(path).getroot()
    for n, tw in enumerate(root.iter("table-wrap")):
        cap = tw.find("caption")
        caption = text(cap) if cap is not None else ""
        rows = [[text(c) for c in tr if c.tag in ("td", "th")] for tr in tw.iter("tr")]
        yield f"table{n + 1}", caption, rows


def docx_tables(data):
    root = ET.fromstring(zipfile.ZipFile(io.BytesIO(data)).read("word/document.xml"))
    for n, tbl in enumerate(root.iter(W + "tbl")):
        rows = [[text(tc) for tc in tr.iter(W + "tc")] for tr in tbl.iter(W + "tr")]
        # the paragraph just before a table is usually its caption; ElementTree has no parent links, so skip it
        yield f"docx_table{n + 1}", "", rows


def col_index(ref):
    letters = re.match(r"[A-Z]+", ref).group()
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def xlsx_tables(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        shared = [
            text(si)
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(S + "si")
        ]
    for name in sorted(
        n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n)
    ):
        rows = []
        for r in ET.fromstring(z.read(name)).iter(S + "row"):
            row = {}
            for c in r.iter(S + "c"):
                v = c.find(S + "v")
                if v is None:
                    is_ = c.find(S + "is")
                    val = text(is_) if is_ is not None else ""
                else:
                    val = shared[int(v.text)] if c.get("t") == "s" else (v.text or "")
                row[col_index(c.get("r"))] = val.strip()
            if row:
                rows.append([row.get(i, "") for i in range(max(row) + 1)])
            if len(rows) > 2000:
                break
        yield os.path.basename(name), "", rows


def pdf_tables(data):
    """pdftotext -layout lines split on runs of 2+ spaces; each page is one 'table'."""
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(data)
        f.flush()
        res = subprocess.run(
            ["pdftotext", "-layout", f.name, "-"], capture_output=True, timeout=120
        )
    for n, page in enumerate(res.stdout.decode("utf-8", "replace").split("\f")):
        rows = [
            re.split(r"\s{2,}", ln.strip()) for ln in page.splitlines() if ln.strip()
        ]
        # a header can sit anywhere on a page; restart the table at each header-looking line
        for i, row in enumerate(rows):
            if name_column([row]):
                yield f"pdf_page{n + 1}_line{i + 1}", "", rows[i : i + 120]


READERS = {".docx": docx_tables, ".xlsx": xlsx_tables, ".pdf": pdf_tables}


def paper_tables(d):
    """(source, label, caption, rows) for the full text and each supplement in a paper's folder."""
    for name in sorted(os.listdir(d)):
        path = os.path.join(d, name)
        ext = os.path.splitext(name)[1].lower()
        try:
            if ext == ".xml":
                for label, caption, rows in jats_tables(path):
                    yield "fulltext", label, caption, rows
            elif ext in READERS:
                with open(path, "rb") as f:
                    data = f.read()
                for label, caption, rows in READERS[ext](data):
                    yield "suppl", f"{name}:{label}", caption, rows
        except Exception as e:  # noqa: BLE001 -- a broken file should not stop the run
            print(f"{path}: {e}", file=sys.stderr)


def main():
    epmc, out = sys.argv[1], sys.argv[2]
    with open(os.path.join(epmc, "papers.tsv"), encoding="utf-8") as f:
        papers = {
            r["pmcid"]: r for r in csv.DictReader(f, delimiter="\t") if r["pmcid"]
        }
    n_tables = n_cells = 0
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, delimiter="\t")
        w.writeheader()
        for pmcid, p in sorted(papers.items()):
            d = os.path.join(epmc, "files", pmcid)
            if not os.path.isdir(d):
                continue
            for source, label, caption, rows in paper_tables(d):
                header, found = cells(rows, caption)
                if not found:
                    continue
                n_tables += 1
                for cell, row in found:
                    n_cells += 1
                    w.writerow(
                        {
                            "pmcid": pmcid,
                            "pmid": p["pmid"],
                            "year": p["year"],
                            "title": p["title"][:200],
                            "source": source,
                            "table": label,
                            "header": header,
                            "cell": cell,
                            "row": row,
                        }
                    )
    print(f"{n_tables} sample tables, {n_cells} cells", file=sys.stderr)


if __name__ == "__main__":
    main()
