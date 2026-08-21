# College dataset — provenance and regeneration

`colleges.json` is the input to `../seed-universities.mjs`. Every value in it
traces back to an official source; nothing is hand-typed or model-generated,
because seat counts and ranks are facts students make decisions on.

## Sources

| Field | Source |
|---|---|
| `name`, `state`, `type`, `mbbsSeats` | NMC **MBBS Seat Matrix as on 16.10.2025 (AY 2025-26)** — [nmc.org.in](https://www.nmc.org.in/) public notice PDF |
| `nirfRank`, some `city` | **NIRF India Rankings 2025 — Medical** — [nirfindia.org](https://www.nirfindia.org/Rankings/2025/MedicalRanking.html) |
| remaining `city` | parsed from the trailing comma-segment of the college name |
| `imageUrl` (via `images.json`) | English Wikipedia lead images, **CC / public-domain licences only** |

## Contents

- 842 colleges: 819 from the NMC matrix + 23 NIRF-ranked institutes that have
  no MBBS intake (PGIMER, SGPGI, NIMHANS …) and so aren't in the seat matrix.
- 455 government, 364 private, 23 unknown type (the NIRF-only additions).
- 50 unique NIRF ranks, 818 with seat counts, 581 with a city.

## Known gaps — deliberately left null rather than guessed

- **`city`** — the NMC matrix has no city column. Derivable from the name for
  ~69%; the rest are null. The column was made nullable for this reason.
- **`DEEMED`** — NMC's management column only distinguishes
  Govt./Trust/Society/Private, so deemed universities are indistinguishable
  from other private colleges and all land as `PRIVATE`.
- **`establishedYear`, `website`, `description`** — not present in either
  source.

## Regenerating

```bash
# 1. facts
curl -o nmc_seat_matrix.pdf "https://www.nmc.org.in/MCIRest/open/getDocument?path=/Documents/Public/Portal/LatestNews/MBBS+Seat+Matrix+as+on+16-10-2025.pdf"
python3 parse_nmc.py          # -> nmc_parsed.json   (needs pdfplumber)

# 2. ranks
curl -o nirf_medical.html "https://www.nirfindia.org/Rankings/2025/MedicalRanking.html"
#    parsed inline with beautifulsoup4 — see git history

# 3. merge
python3 merge.py              # -> colleges.json

# 4. images (slow: ~840 colleges x 3 API calls, rate-limited)
python3 fetch_images.py       # -> images.json
```

`parse_nmc.py` uses **pdfplumber**, not pypdf. pypdf returns `x=y=0` for a
subset of this PDF's text runs, which silently attaches seat counts to the
wrong colleges — it looks fine and is wrong. Don't switch it back.

`fetch_images.py` enforces two guards worth keeping:

1. **Licence** — only CC/PD images are accepted. Wikipedia lead images for
   Indian colleges are frequently non-free logos uploaded under fair use.
2. **Title match** — the article title must token-match the college name.
   Without it, a search for "…Institute of Medical Sciences, Port Blair"
   returns the article for the *town* of Port Blair and we would ship a photo
   of a town as that college's campus.

Colleges with no free image keep `imageUrl = null`; the mobile hero renders a
per-college branded gradient + initials rather than a stock photo of some
unrelated campus.

## `dnb-colleges.json` — DNB accreditation + specializations

Input to `../seed-dnb-colleges.mjs`. Source: an NBEMS accreditation portal
extract supplied directly by the user (snapshot dated 19-08-2026, 5,389
accreditation records), grouped here to one entry per
(Hospital/Institute, Address, State, PIN) with its distinct accredited
`specializations` list — 1,397 unique institutions.

Populates `Program.specializations` for a `DNB` program at each matched or
newly-created `University` row — see the seed script's own header comment
for the exact matching/creation rules (name+state match against existing
universities, `type` defaults to `PRIVATE` since the source doesn't state
ownership).

Unlike the UG/PG datasets above, this isn't (yet) wired into the
`refresh_ug.py`/`refresh_pg.py`-style live-refresh pipeline — it was a
one-time spreadsheet import. A live NBEMS scraper would be the natural next
step if this needs to stay current, mirroring `refresh_pg.py`'s approach.

## `pg-mdms-colleges.json` — MD/MS broad specialty seats + specializations

No seed script yet — generated but not yet consumed; add a
`seed-pg-mdms-colleges.mjs` mirroring `seed-dnb-colleges.mjs`'s
matching/creation rules when ready to load this in. Source: NMC's public
"PG Broad Specialty Seat Matrix" notice (AY 2025-26, supplied directly by
the user), 8,327 course records grouped to one entry per (College Name,
State) with its distinct `"MD - <specialty>"` / `"MS - <specialty>"`
`specializations` list — 568 unique institutions. Unlike `dnb-colleges.json`
this source states real ownership (`type`: GOVERNMENT/PRIVATE, mapped from
the Govt/Trust/Society/Private/Pvt management column), so it doesn't need
the DNB set's blanket-PRIVATE default. No address/PIN in this source — only
College Name + State, matching the College/University field's "name, state"
display convention (no address shown, even for DNB).

11 rows were dropped from the source: they were PG Diploma courses (e.g.
"DOMS", "DIP. ANAESTHESIOLOGY") mislabeled without an MD/MS prefix in this
sheet — out of scope here since Diploma is a separate degree option from
MD/MS.

## `dm-mch-colleges.json` — DM/MCh super-specialty seats + specializations

Input to `../seed-dm-mch-colleges.mjs`, which mirrors
`seed-pg-mdms-colleges.mjs`'s matching/creation rules but writes its own
"DM/MCh" Program per college rather than sharing MD/MS's. Source: NMC's public
"Super-Specialty Seat Matrix" notice (AY 2025-26, supplied directly by the
user), 1,359 course records grouped to one entry per (College Name, State)
with its distinct `"DM - <specialty>"` / `"MCh - <specialty>"`
`specializations` list — 216 unique institutions. `type`
(GOVERNMENT/PRIVATE) comes from the source's management column, same as
`pg-mdms-colleges.json`. Own dataset — not merged with PG/MD-MS/Doctorate.

**This source is noisier than the others**: 12 rows had scrambled/garbled
Course Name text (e.g. `"logy VisakhaMpa.Ctnha m- Neuro Surgery"` — looks
like a PDF-extraction column-bleed artifact in NMC's own notice) and were
dropped; the Management column had similar garbling in ~55 rows, mapped to
GOVERNMENT/PRIVATE by a lenient "contains govt/govern" substring check
rather than an exact lookup, so a handful of `type` values here are
best-effort guesses, not verified fact the way `pg-mdms-colleges.json`'s are.
Specialization labels are transcribed as-is from the source even where a
label looks questionable (e.g. `"MCh - Cardiology"` — Cardiology is
ordinarily a DM specialty) rather than silently "corrected" against what
the specialty is more commonly categorized as.

## Refreshing on demand — `refresh_ug.py` / `refresh_pg.py`

The steps above are also available as two standalone, re-runnable scripts
that print fresh JSON to stdout instead of writing files — these are what
the admin panel's "Refresh college data" button (see
`src/modules/data-import/`) invokes via a subprocess. Nothing here writes to
the database directly; the backend diffs the output against the live
`universities` table and an admin reviews the diff before anything is
applied. See that module's own docs for the apply flow.

```bash
pip install -r requirements.txt
python3 -m playwright install --with-deps chromium   # only needed for refresh_pg.py

python3 refresh_ug.py > ug_latest.json   # NMC PDF + NIRF, ~30s
python3 refresh_pg.py > pg_latest.json   # MCC PG institute tool, ~20s
```

`refresh_pg.py` needs a real browser (Playwright), not `requests`, because
MCC's tool loads all ~1,940 institutes into a client-side DataTable
(`serverSide: false`) and only ever renders 10 rows in the DOM at once — a
plain HTML scrape would see just the visible page. It also re-finds the
"Participating Institute Details" link from
`mcc.nic.in/pg-medical-counselling/` on every run rather than hardcoding the
URL, since its `enc=` token is tied to the current counselling year and
changes annually.
