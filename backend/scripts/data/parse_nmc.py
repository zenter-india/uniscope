"""Extract the NMC MBBS seat matrix PDF into structured JSON.

Source: NMC "SEAT MATRIX AS ON 16.10.2025 (MBBS) FOR THE AY 2025-26
(including AIIMS, CGI & JIPMER)" — nmc.org.in public notice.

pdfplumber's ruling-line table extraction handles this cleanly; the earlier
coordinate approach failed because a subset of text runs report x=y=0.
"""
import json
import re

import pdfplumber

PDF = "nmc_seat_matrix.pdf"
OUT = "nmc_parsed.json"

HEADER = re.compile(r"S\.No\.|SEAT MATRIX|Name of college", re.I)


def clean(cell):
    return re.sub(r"\s+", " ", (cell or "").replace("\n", " ")).strip()


def parse():
    rows = []
    with pdfplumber.open(PDF) as pdf:
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
                if HEADER.search(name):
                    continue
                seats = None
                for candidate in (s25, s24):
                    m = re.search(r"\d+", candidate or "")
                    if m:
                        seats = int(m.group())
                        break
                rows.append(
                    {
                        "sno": int(sno),
                        "state": state,
                        "name": name,
                        "mgmt": mgmt,
                        "seats": seats,
                    }
                )
    rows.sort(key=lambda r: r["sno"])
    return rows


def main():
    rows = parse()
    json.dump(rows, open(OUT, "w"), indent=1)

    snos = [r["sno"] for r in rows]
    print(f"rows extracted : {len(rows)}")
    print(f"S.No. range    : {min(snos)}..{max(snos)}   unique: {len(set(snos))}")
    missing = sorted(set(range(1, max(snos) + 1)) - set(snos))
    print(f"missing S.No.  : {len(missing)} {missing[:12]}")
    print(f"total seats    : {sum(r['seats'] or 0 for r in rows):,}")
    print(f"no seats value : {len([r for r in rows if not r['seats']])}")
    print(f"blank names    : {len([r for r in rows if not r['name']])}")

    mg = {}
    for r in rows:
        mg[r["mgmt"]] = mg.get(r["mgmt"], 0) + 1
    print("\nmanagement values:")
    for k, v in sorted(mg.items(), key=lambda kv: -kv[1]):
        print(f"   {v:>4}  {k!r}")

    st = {}
    for r in rows:
        st[r["state"]] = st.get(r["state"], 0) + 1
    print(f"\ndistinct states: {len(st)}")
    for k, v in sorted(st.items(), key=lambda kv: -kv[1])[:8]:
        print(f"   {v:>4}  {k}")

    print("\nspot checks:")
    for needle in ["Vellore", "JIPMER", "Maulana Azad", "Mangalagiri", "Kasturba", "Grant Medical"]:
        for h in [r for r in rows if needle.lower() in r["name"].lower()][:1]:
            print(f"   {h['sno']:>4} | {h['state']:<16} | {h['name'][:52]:<52} | {h['mgmt']:<8} | {h['seats']}")


if __name__ == "__main__":
    main()
