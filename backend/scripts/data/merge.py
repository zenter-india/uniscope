"""Merge NMC seat matrix + NIRF rankings into the final college dataset.

Outputs colleges.json shaped for the Uniscope `universities` table.
Never invents a value: a field we cannot source stays null.
"""
import json
import re

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


def norm_tokens(name):
    words = re.findall(r"[a-z0-9]+", name.lower())
    return {w for w in words if w not in STOP and len(w) > 2}


def similarity(a, b):
    ta, tb = norm_tokens(a), norm_tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def city_from_name(name, state):
    """Trailing comma-segment of the college name, when it looks like a city."""
    parts = [p.strip() for p in name.split(",") if p.strip()]
    if len(parts) < 2:
        return None
    c = parts[-1]
    # strip trailing state names / abbreviations that aren't cities
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
    # NMC does not distinguish deemed universities; Trust/Society/Private/Company
    # all collapse to PRIVATE rather than guessing DEEMED.
    return "PRIVATE"


def main():
    nmc = json.load(open("nmc_parsed.json"))
    nirf = json.load(open("nirf_parsed.json"))

    for r in nmc:
        r["_state"] = STATE_FIX.get(r["state"].strip(), r["state"].strip())

    # Score every plausible (NMC, NIRF) pair, then assign greedily best-first so
    # each NIRF rank lands on exactly one college. A per-row "best match" loop
    # is not enough: two Mangalore colleges both claimed rank 35 that way.
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
                "mbbsSeats": r["seats"],
                "nirfRank": matched["rank"] if matched else None,
                "source": "NMC 2025-26 seat matrix",
            }
        )

    # NIRF institutes with no MBBS intake (PG-only) are still real medical
    # institutions students care about — carry them in with null seats.
    for n in nirf:
        if n["rank"] in used_nirf:
            continue
        colleges.append(
            {
                "name": n["name"],
                "state": STATE_FIX.get(n["state"].strip(), n["state"].strip()),
                "city": n["city"],
                "type": None,  # unknown from NIRF alone
                "stream": "Medical",
                "mbbsSeats": None,
                "nirfRank": n["rank"],
                "source": "NIRF 2025 medical ranking",
            }
        )

    json.dump(colleges, open("colleges.json", "w"), indent=1)

    ranked = [c for c in colleges if c["nirfRank"]]
    print(f"colleges total   : {len(colleges)}")
    print(f"  from NMC       : {len([c for c in colleges if c['source'].startswith('NMC')])}")
    print(f"  NIRF-only add  : {len(colleges) - len([c for c in colleges if c['source'].startswith('NMC')])}")
    print(f"with nirfRank    : {len(ranked)}  (ranks {sorted(c['nirfRank'] for c in ranked)[:6]}...)")
    print(f"with city        : {len([c for c in colleges if c['city']])} / {len(colleges)}")
    print(f"with mbbsSeats   : {len([c for c in colleges if c['mbbsSeats']])}")
    print(f"type GOVERNMENT  : {len([c for c in colleges if c['type']=='GOVERNMENT'])}")
    print(f"type PRIVATE     : {len([c for c in colleges if c['type']=='PRIVATE'])}")
    print(f"type unknown     : {len([c for c in colleges if not c['type']])}")

    dupes = {}
    for c in colleges:
        k = c["name"].lower().strip()
        dupes[k] = dupes.get(k, 0) + 1
    print(f"duplicate names  : {len([k for k,v in dupes.items() if v>1])}")

    print("\ntop-ranked matches:")
    for c in sorted(ranked, key=lambda x: x["nirfRank"])[:10]:
        print(f"  #{c['nirfRank']:>2} {c['name'][:56]:<56} {str(c['city'])[:14]:<14} seats={c['mbbsSeats']}")


if __name__ == "__main__":
    main()
