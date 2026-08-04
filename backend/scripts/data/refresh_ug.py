"""Re-run the full UG (MBBS) capture pipeline on demand and print the result
as JSON to stdout.

Invoked by the backend's DataImportService (see
src/modules/data-import/data-import.service.ts) via a child_process, so the
admin "Refresh college data" button in admin panel re-derives fresh data
from the same two official sources the dataset was originally built from —
NMC's MBBS seat-matrix PDF and NIRF's medical rankings — instead of relying
on a snapshot that goes stale.

This is capture only: it never touches the database. The backend diffs the
printed JSON against the live `universities` table and shows an admin a
preview before anything is written (see data-import.service.ts computeDiff).

Combines parse_nmc.py + (previously inline, now real) NIRF fetch + merge.py's
matching logic into one entry point so a single subprocess call produces the
final college list. Kept dependency-light: pdfplumber + requests +
beautifulsoup4, the same three already used by the standalone scripts this
replaces the manual steps of.
"""
import json
import re
import sys
import tempfile
from pathlib import Path

import pdfplumber
import requests
from bs4 import BeautifulSoup

NMC_PDF_URL = (
    "https://www.nmc.org.in/MCIRest/open/getDocument"
    "?path=/Documents/Public/Portal/LatestNews/MBBS+Seat+Matrix+as+on+16-10-2025.pdf"
)
NIRF_URL = "https://www.nirfindia.org/Rankings/2025/MedicalRanking.html"
HEADERS = {"User-Agent": "Mozilla/5.0 (UniscopeDataImport/1.0)"}

HEADER_RE = re.compile(r"S\.No\.|SEAT MATRIX|Name of college", re.I)

STOP = {
    "the", "of", "and", "for", "institute", "institution", "college", "medical",
    "sciences", "science", "hospital", "research", "centre", "center", "school",
    "university", "postgraduate", "post", "graduate", "education", "&",
}

STATE_FIX = {
    "Pondicherry": "Puducherry",
    "Chattisgarh": "Chhattisgarh",
    "Orissa": "Odisha",
    "Jammu & Kashmir": "Jammu and Kashmir",
    "Dadra and Nagar": "Dadra and Nagar Haveli",
}


def clean(cell):
    return re.sub(r"\s+", " ", (cell or "").replace("\n", " ")).strip()


def fetch_nmc_pdf(dest: Path):
    resp = requests.get(NMC_PDF_URL, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    dest.write_bytes(resp.content)


def parse_nmc(pdf_path: Path):
    """Table-structure extraction via pdfplumber — NOT pypdf's coordinate
    extraction, which silently returns x=y=0 for a subset of this PDF's text
    runs and misattributes seat counts to the wrong college. See README.md."""
    rows = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if not table:
                continue
            for raw in table:
                cells = [clean(c) for c in raw]
                if len(cells) < 6:
                    continue
                sno, state, name, mgmt, s24, s25 = cells[:6]
                if not re.fullmatch(r"\d{1,4}", sno):
                    continue
                if HEADER_RE.search(name):
                    continue
                seats = None
                for candidate in (s25, s24):
                    m = re.search(r"\d+", candidate or "")
                    if m:
                        seats = int(m.group())
                        break
                rows.append({"sno": int(sno), "state": state, "name": name, "mgmt": mgmt, "seats": seats})
    rows.sort(key=lambda r: r["sno"])
    return rows


def fetch_nirf():
    resp = requests.get(NIRF_URL, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find_all("table")[0]
    out = []
    for row in table.find_all("tr"):
        cells = [c.get_text(strip=True) for c in row.find_all(["td", "th"])]
        # Data rows are 16 cells: id, junk-laden name, 5 metric labels,
        # 5 metric values, city, state, score, rank. Everything else
        # (metric-only sub-rows) is a shorter row we skip.
        if len(cells) != 16:
            continue
        rank_raw = cells[-1]
        if not re.fullmatch(r"\d+", rank_raw):
            continue
        name = cells[1].split("More Details")[0].strip()
        out.append(
            {
                "name": name,
                "city": cells[-4],
                "state": cells[-3],
                "rank": int(rank_raw),
            }
        )
    return out


def norm_tokens(name):
    words = re.findall(r"[a-z0-9]+", name.lower())
    return {w for w in words if w not in STOP and len(w) > 2}


def similarity(a, b):
    ta, tb = norm_tokens(a), norm_tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def city_from_name(name, state):
    parts = [p.strip() for p in name.split(",") if p.strip()]
    if len(parts) < 2:
        return None
    c = parts[-1]
    c = re.sub(
        r"\b(U\.?P\.?|A\.?P\.?|W\.?B\.?|M\.?P\.?|T\.?N\.?|Uttar Pradesh|Andhra Pradesh|"
        r"West Bengal|Madhya Pradesh|Tamil Nadu|Telangana|Maharashtra|Karnataka|Gujarat|"
        r"Rajasthan|Bihar|Odisha|Kerala|Punjab|Haryana|Assam|Jharkhand|Chhattisgarh|"
        r"Chattisgarh|Uttarakhand|Uttrakhand|Jammu and Kashmir|Himachal Pradesh)\b",
        "",
        c,
        flags=re.I,
    ).strip(" .-–")
    if not (2 < len(c) <= 60):
        return None
    if re.search(r"\d", c):
        return None
    return c


def map_type(mgmt):
    m = (mgmt or "").strip().lower()
    if m.startswith("govt"):
        return "GOVERNMENT"
    return "PRIVATE"


def merge(nmc, nirf):
    for r in nmc:
        r["_state"] = STATE_FIX.get(r["state"].strip(), r["state"].strip())

    pairs = []
    for i, r in enumerate(nmc):
        for n in nirf:
            nstate = STATE_FIX.get(n["state"].strip(), n["state"].strip())
            if nstate != r["_state"] and n["city"].lower() not in r["name"].lower():
                continue
            s = similarity(r["name"], n["name"])
            if s >= 0.45:
                pairs.append((s, i, n["rank"]))
    pairs.sort(key=lambda p: -p[0])

    match_for = {}
    used_nirf = set()
    for s, i, rank in pairs:
        if i in match_for or rank in used_nirf:
            continue
        match_for[i] = rank
        used_nirf.add(rank)

    nirf_by_rank = {n["rank"]: n for n in nirf}
    colleges = []

    for i, r in enumerate(nmc):
        state = r["_state"]
        matched = nirf_by_rank.get(match_for.get(i))
        colleges.append(
            {
                "name": r["name"],
                "state": state,
                "city": (matched["city"] if matched else None) or city_from_name(r["name"], state),
                "type": map_type(r["mgmt"]),
                "stream": "Medical",
                "levels": ["UG"],
                "mbbsSeats": r["seats"],
                "nirfRank": matched["rank"] if matched else None,
            }
        )

    for n in nirf:
        if n["rank"] in used_nirf:
            continue
        colleges.append(
            {
                "name": n["name"],
                "state": STATE_FIX.get(n["state"].strip(), n["state"].strip()),
                "city": n["city"],
                "type": None,
                "stream": "Medical",
                "levels": ["UG"],
                "mbbsSeats": None,
                "nirfRank": n["rank"],
            }
        )
    return colleges


def main():
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = Path(tmp) / "nmc_seat_matrix.pdf"
        fetch_nmc_pdf(pdf_path)
        nmc = parse_nmc(pdf_path)

    nirf = fetch_nirf()
    colleges = merge(nmc, nirf)
    json.dump(colleges, sys.stdout)


if __name__ == "__main__":
    main()
