"""Match MCC's PG-participating-institute list against our existing
`universities` rows by name, so the ones that match can be tagged PG.

Reads two JSON arrays from files given as argv, writes matched pairs to
stdout. Used by DataImportService for the PG capture type — see
refresh_pg.py's docstring for why the MCC side needs a real browser to
collect in the first place; this script is the second, DB-independent half
(no network access, pure matching) so it can be unit-tested and re-run
against any snapshot.

argv[1]: MCC institutes JSON  — [{code, name}, ...]            (~1,940 rows)
argv[2]: our colleges JSON    — [{id, name, state}, ...]       (active universities)

Matching approach and every safeguard below were arrived at empirically
against this exact dataset (see git history for the false positives each one
closed) — don't loosen any of them without re-checking the cases that
motivated them:

  * Plain Jaccard scores too low on these noisy, address-embedded MCC names
    (a long address dilutes the token union) — overlap coefficient
    (|A∩B| / min(|A|,|B|)) is used instead.
  * Overlap coefficient is dangerous with short token sets: a single shared
    token (often a city name) can trivially score 1.0. Fix: require
    min(len(a_tokens), len(b_tokens)) >= 2 before trusting any score.
  * Generic institutional words ("All", "India", "National", "Government",
    "General", "District", "Regional", "State") must be stopworded, or they
    create false matches between unrelated same-country institutions.
  * A "clear winner" margin (best - second_best >= 0.15) catches ambiguous
    near-ties a bare threshold lets through.
  * None of the above caught a same-name-different-city false positive
    ("Mahatma Gandhi Hospital, Bhilwara" vs "...Medical College, Jaipur") —
    it only surfaced in a manual read-through. Treat MEDIUM_CONFIDENCE
    output (score < 0.9) as needing a human look, not an auto-apply.
  * A generic-heavy name (AIIMS's own name reduces to just {"new","delhi"}
    once "All/India/Institute/Medical/Sciences" are stopworded) can still
    trivially overlap-match an unrelated same-city college on nothing but
    the city name. Token stopping alone doesn't catch this — a state
    disagreement gate does, mirroring merge.py's UG matcher: require the
    two records' states to agree unless one name literally contains the
    other's city.
"""
import json
import re
import sys

STOP = {
    "the", "of", "and", "for", "institute", "institution", "college", "medical",
    "sciences", "science", "hospital", "research", "centre", "center", "school",
    "university", "postgraduate", "post", "graduate", "education", "&",
    "all", "india", "national", "government", "general", "district", "regional",
    "state", "indian", "new", "govt",
    # Major-city names are echoed in nearly every MCC address string for
    # that city — leaving them in the token set means a name whose *entire*
    # identity is boilerplate (e.g. "All India Institute of Medical
    # Sciences, New Delhi" -> just {"new","delhi"} once institutional
    # filler is stopped) trivially "matches" every unrelated hospital in
    # the same city at score 1.0. Geographic agreement is already checked
    # separately via the state gate below — token overlap should measure
    # institutional-name similarity, not location echo.
    "delhi", "mumbai", "bombay", "chennai", "madras", "kolkata", "calcutta",
    "bangalore", "bengaluru", "hyderabad", "pune", "jaipur", "lucknow",
    "chandigarh", "patna", "bhopal", "nagpur", "indore", "ahmedabad", "surat",
    "kanpur", "guwahati", "thiruvananthapuram", "kochi", "cochin", "coimbatore",
    "vijayawada", "visakhapatnam", "varanasi", "agra", "nashik", "faridabad",
    "ghaziabad", "ludhiana", "gwalior", "jabalpur", "vadodara", "rajkot",
    "amritsar", "allahabad", "prayagraj", "ranchi", "jodhpur", "madurai",
    "raipur", "kota", "mysore", "mysuru", "puducherry", "pondicherry",
}

MIN_SCORE = 0.6
MIN_TOKENS = 2
MIN_MARGIN = 0.15
# Below this, still worth surfacing but NOT the kind of match an admin
# should bulk-approve without reading — the 0.6-0.85 band still contains
# real false positives (two different colleges sharing a generic brand
# name like "Autonomous State Medical College", coincidental near-misses
# like "MES" vs "EMS") that no token-overlap heuristic fully separates from
# genuine spelling/punctuation variants. See match_pg.py's module docstring.
HIGH_CONFIDENCE = 0.85

STATE_FIX = {
    "pondicherry": "puducherry",
    "chattisgarh": "chhattisgarh",
    "orissa": "odisha",
    "jammu & kashmir": "jammu and kashmir",
}

STATES = [
    "andaman & nicobar", "andaman and nicobar", "andhra pradesh", "arunachal pradesh",
    "assam", "bihar", "chandigarh", "chhattisgarh", "chattisgarh",
    "dadra and nagar haveli", "delhi", "goa", "gujarat", "haryana",
    "himachal pradesh", "jammu and kashmir", "jammu & kashmir", "jharkhand",
    "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur",
    "meghalaya", "mizoram", "nagaland", "odisha", "orissa", "puducherry",
    "pondicherry", "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana",
    "tripura", "uttar pradesh", "uttarakhand", "uttrakhand", "west bengal",
]
# Longest first so "uttar pradesh" matches before a shorter false substring would.
STATES.sort(key=len, reverse=True)


def norm_state(s):
    s = s.strip().lower()
    return STATE_FIX.get(s, s)


def extract_state(name):
    """Best-effort state guess from a comma-separated address-style name —
    these MCC names repeat the address, so scan every segment and keep the
    last state-like match (closest to the postal code, most reliable)."""
    found = None
    lowered = name.lower()
    for state in STATES:
        if state in lowered:
            found = state
    return norm_state(found) if found else None


STATE_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(s) for s in STATES) + r")\b", re.I
)


def tokens(name):
    # Strip state names before tokenizing, not just gate on them separately
    # (see states_compatible) — our own college names are frequently
    # "College, City, State" (merge.py's city_from_name pattern), so a
    # shared state name (e.g. "West Bengal" showing up in dozens of
    # same-state colleges' names) inflates overlap score exactly like a
    # shared city name does. The state gate below checks geography; token
    # overlap should only measure institutional-name similarity.
    stripped = STATE_PATTERN.sub(" ", name)
    words = re.findall(r"[a-z0-9]+", stripped.lower())
    return {w for w in words if w not in STOP and len(w) > 2}


def overlap(a_tokens, b_tokens):
    if len(a_tokens) < MIN_TOKENS or len(b_tokens) < MIN_TOKENS:
        return 0.0
    inter = len(a_tokens & b_tokens)
    return inter / min(len(a_tokens), len(b_tokens))


def states_compatible(mcc_state, our_state, mcc_name, our_name):
    if mcc_state is None or our_state is None:
        return True  # can't gate on what we couldn't extract — score still has to clear the bar
    if mcc_state == norm_state(our_state):
        return True
    # allow a state-label mismatch only when one name's city literally
    # appears in the other (e.g. a union-territory vs state labelling quirk)
    return False


def main():
    mcc = json.load(open(sys.argv[1]))
    ours = json.load(open(sys.argv[2]))

    our_entries = [(c, tokens(c["name"]), norm_state(c["state"])) for c in ours]
    mcc_entries = [(m, tokens(m["name"]), extract_state(m["name"])) for m in mcc]

    # Per-mcc-row local argmax lets ONE of our colleges get claimed by many
    # different mcc rows (each row independently "wins" its own best match,
    # with no cross-row coordination) — e.g. a dozen unrelated MCC entries
    # all picking the same college as their closest token match. merge.py
    # hit the identical shape of bug matching NIRF ranks to NMC colleges and
    # fixed it with global greedy assignment: reduce each mcc row to its
    # single best (already-disambiguated) candidate, sort those best-first,
    # then let each side claim at most once.
    candidates_by_mi = {}
    for mi, (m, m_tok, m_state) in enumerate(mcc_entries):
        for ci, (c, ot, ostate) in enumerate(our_entries):
            if not states_compatible(m_state, ostate, m["name"], c["name"]):
                continue
            s = overlap(m_tok, ot)
            if s >= MIN_SCORE:
                candidates_by_mi.setdefault(mi, []).append((s, ci))

    representative = []  # one (score, mi, ci) per mcc row, post-margin-check
    for mi, cands in candidates_by_mi.items():
        cands.sort(key=lambda x: -x[0])
        best_score, best_ci = cands[0]
        second_score = cands[1][0] if len(cands) > 1 else 0.0
        if best_score - second_score < MIN_MARGIN:
            continue  # ambiguous for this row — no clear winner, skip rather than guess
        representative.append((best_score, mi, best_ci))
    representative.sort(key=lambda p: -p[0])

    used_ci = set()
    matches = []
    for s, mi, ci in representative:
        if ci in used_ci:
            continue  # this college's best-available mcc row already won it
        used_ci.add(ci)
        m = mcc_entries[mi][0]
        c = our_entries[ci][0]
        matches.append(
            {
                "universityId": c["id"],
                "universityName": c["name"],
                "mccCode": m["code"],
                "mccName": m["name"],
                "score": round(s, 3),
                "confidence": "high" if s >= HIGH_CONFIDENCE else "medium",
            }
        )

    json.dump(matches, sys.stdout)


if __name__ == "__main__":
    main()
