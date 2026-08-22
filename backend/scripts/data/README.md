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
extract supplied directly by the user, grouped here to one entry per
(College, District, State) with its distinct accredited `specializations`
list. **Like MD/MS, the mentor form's College field for DNB is now a full
browse-+ type-to-search combobox** (`CuratedCollegeSearch`), not the
curated-30-+-"Other" pattern — see `MentorForm.tsx`'s `BROWSE_DEGREES` set.

**Updated once already**, this time with a genuinely cleaner re-export
(`DNB_Accreditation_Clean.xlsx`, sheet "Clean Data") — a proper `District`
column instead of the original's raw Address/PIN text, plus 10 rows the
user had already removed as mismatched (missing state). Original: 1,397
unique (name, address, state, pin) institutions. This refresh: **1,378**
unique (name, district, state) institutions from 5,362 clean records —
grouping by district naturally yields fewer, coarser entries than the old
per-address grouping did. Two pairs were also merged that differed only in
letter casing (e.g. "Ankura Hospital..." vs "Ankura hospital...",
same district) — case-insensitive dedup, keeping the first-seen casing as
canonical.

The seed script's within-run branch-disambiguation key (see its own header
comment — hospital chains like "Ankura Hospital" repeat the same name in
the same state for genuinely different branches) switched from
name+state+**address** to name+state+**district** to match. `Program.description`
now carries just the district (was `"<address>, PIN <pin>"`) — still not
shown in the UI, kept for potential future use only.

**Re-running the seed script against this regrouped data will likely
strand some already-seeded Program rows**, the same way the MD/MS refresh
did (see that section below) — a hospital previously split across several
address-based entries may now collapse into fewer district-based ones, so
whichever old University row doesn't get re-matched becomes stale. Re-run
the same stale-row detection process (compare live DB names+states against
this file, one query, no code needed) after seeding and expect to need a
similar `is_active = false` cleanup pass.

Unlike the UG/PG datasets above, this isn't (yet) wired into the
`refresh_ug.py`/`refresh_pg.py`-style live-refresh pipeline — it was a
one-time spreadsheet import. A live NBEMS scraper would be the natural next
step if this needs to stay current, mirroring `refresh_pg.py`'s approach.

## `pg-mdms-colleges.json` — MD/MS broad specialty seats + specializations

Input to `../seed-pg-mdms-colleges.mjs`. Source: NMC's public "PG Broad
Specialty Seat Matrix" notice (AY 2025-26, supplied directly by the user),
grouped to one entry per (College Name, State) with its distinct
`"MD - <specialty>"` / `"MS - <specialty>"` `specializations` list.
Unlike `dnb-colleges.json` this source states real ownership (`type`:
GOVERNMENT/PRIVATE, mapped from the Govt/Trust/Society/Private/Pvt
management column), so it doesn't need the DNB set's blanket-PRIVATE
default. No address/PIN in this source — only College Name + State,
matching the College/University field's "name, state" display convention
(no address shown, even for DNB).

**Like DNB and Diploma (see below), this dataset is small/complete
enough to browse in full rather than curate a top-N subset** — the
mentor form's College and Specialization fields for PG/MD-MS/Doctorate
are both full browse-+ type-to-search comboboxes (`CuratedCollegeSearch`
+ `SearchableCombobox` in `web/components/`), backed by
`GET /universities/curated?browse=true` (see
`UniversitiesService.findCurated`'s two modes). DM-MCh is the only
degree still on the original curated-top-30-+-"Other" `<select>` pattern.

**Updated twice already.** First refresh (still 8 columns, same "Course
Name" combining degree+specialty): 9,279 course records (up from 8,327),
649 unique institutions (up from 568), same parsing/grouping/length-fix
pipeline. Second refresh came from a differently-shaped export
(`NMC_PG_Seats_2025-26.xlsx`, sheet "PG Seats Data") — `Specialization` is
already its own column here (no "MD - "/"MS - " prefix parsing needed),
plus a `Management` column same as before: 9,395 records, 653 unique
institutions. Regenerate the same way (adjusting the parse step to match
whichever column layout the new file actually has) if a further-updated
version shows up.

12 rows were dropped from the first refresh's source: they were PG Diploma
courses (e.g.
"DOMS", "DIP. ANAESTHESIOLOGY") mislabeled without an MD/MS prefix in this
sheet — out of scope here since Diploma is a separate degree option from
MD/MS.

**A real ownership-detection bug, found and fixed on the second refresh's
own re-check.** `Management` values in this source aren't always the
clean single word the first refresh's exact-match lookup assumed — e.g.
`"Govern ment"` (17 rows, a stray-space typo for "Government") and
`"Govt.- Society"` (51 rows — this is GMERS, an actual Gujarat
*government* medical education society) both fell through to the
PRIVATE default under exact matching. Fixed by switching to the same
lenient "strip non-letters, then check for govt/govern as a substring"
approach `seed-dm-mch-colleges.mjs` already used — verified GMERS's 8
colleges and ACSR Government Medical College Nellore are now correctly
GOVERNMENT. Net result: 350 GOVERNMENT / 303 PRIVATE (previously skewed
too-PRIVATE by the missed cases). Same substring approach, worth applying
if any future dataset here has a similarly free-text ownership column.

**The garbled names spotted in the live database after this (`"/Deem ed
Amrita School of Medicine, Faridabad"`, `"Society GMERS Medical College,
Gandhinagar"`, `"ACSR Government Medical College Nellore, Andhra
Pradesh"` with the state folded into the name) are not a bug in this
file or the current pipeline** — checked directly against this file's
raw `College Name` column, which is clean for all three. They're stale
rows left over in the database from an earlier, buggier version of this
pipeline, superseded by (not duplicating) the current correct entries —
see the `programs.is_active = false` cleanup applied to those specific
stale rows rather than editing this file.

## `dm-mch-colleges.json` — DM/MCh super-specialty seats + specializations

Input to `../seed-dm-mch-colleges.mjs`, which mirrors
`seed-pg-mdms-colleges.mjs`'s matching/creation rules but writes its own
"DM/MCh" Program per college rather than sharing MD/MS's. Source: NMC's public
"Super-Specialty Seat Matrix" notice (AY 2025-26, supplied directly by the
user), grouped to one entry per (College Name, State) with its distinct
`"DM - <specialty>"` / `"MCh - <specialty>"` `specializations` list.
`type` (GOVERNMENT/PRIVATE) comes from the source's management column,
same as `pg-mdms-colleges.json`. Own dataset — not merged with
PG/MD-MS/Doctorate.

**Updated once already**, and noticeably cleaner than the first version:
1,359 course records (same count), 220 unique institutions (up from 216)
— only 1 row dropped for scrambled Course Name text this time (down from
12), so most of the original PDF-extraction garbling this source is
noted for below appears to have been a one-off in the earlier file, not a
property of the source that recurs on refresh. The State column had a
different, narrower garbling this time — two rows read `"Tamil Nadu Pri"`
/ `"Maharashtra Pri"` (a `" Pri"` fragment leaked in, most likely from an
adjacent management/ownership column) — stripped with a trailing
`/\s+Pri$/i` substitution before grouping; without it, ACS Medical
College and Dr. D.Y.Patil Medical College (Pune) would each have split
into two separate rows instead of one with their full specialization list.

**This source can still be noisier than the others**, per the original
version's garbling (Course Name scrambling, Management-column garbling
handled by a lenient "contains govt/govern" substring check) — see git
history for that writeup if a future refresh reintroduces it.
Specialization labels are transcribed as-is from the source even where a
label looks questionable (e.g. `"MCh - Cardiology"` — Cardiology is
ordinarily a DM specialty) rather than silently "corrected" against what
the specialty is more commonly categorized as.

## `diploma-colleges.json` — NBEMS Diploma accreditation + specializations

Input to `../seed-diploma-colleges.mjs`. Source: an NBEMS Diploma
accreditation portal extract supplied directly by the user, grouped here
to one entry per (College, State) with its distinct `specializations`
list.

**Updated twice already.** First refresh (still address+PIN in the
source): 1,585 accreditation records (up from 1,474), 832 unique
institutions (up from 782), grouped by (Hospital/Institute, Address,
State, PIN). Specialization labels had a trailing `" (NBEMS)"` suffix
stripped (case-insensitive) per the user's request.

**Second refresh (`Diploma_Institutions_Clean.xlsx`, sheet "Clean
Data") dropped address/PIN entirely** — just College, State,
Specialization: 1,461 records, 746 unique (College, State) groups. This
is a real loss of location detail versus the first refresh, not an
improvement (contrast with the DNB refresh around the same time, which
*added* a district column) — generic hospital names that repeat many
times within a state (e.g. "District Hospital" ×7 in Karnataka,
"Capital Hospital" ×7 in Odisha) can no longer be told apart as distinct
branches. Per explicit user confirmation, name+state is now this
dataset's branch key — every row sharing a (College, State) pair is
merged into one college entry, specializations pooled together. If a
future refresh of this source adds district/address back, re-key by
name+state+district the same way `dnb-colleges.json` does, rather than
continuing to merge by name+state alone.

**Specialization labels normalized to plain names** (mirrors the DNB
convention — no abbreviations, no "Diploma in" prefix). The raw source
mixes two inconsistent formats for the same underlying specialty —
`"Diploma in Paediatrics"` and `"Paediatrics (DCH)"` both occur — so
labels were cleaned by stripping leading `"Diploma"`/`"Diploma in"`/
`"Diploma -"`/`"Diploma Courses in"` prefixes and trailing `"(ABBR)"`
parentheticals, then a small explicit canonicalization map merged
remaining near-duplicate spellings (`"Anaesthesia"` → `"Anaesthesiology"`,
`"Obstetrics & Gynaecology"` → `"Obstetrics and Gynaecology"`, `"Radio-
Diagnosis"` → `"Radio Diagnosis"`, `"Tuberculosis & Chest Disease"` →
`"...Diseases"`, `"OBG-DGO"` → `"Obstetrics and Gynaecology"`, `"Social &
Preventive Medicine / Community Medicine"` → `"Community Medicine"`,
`"Forensic Medicine/Forensic Medicine & Toxicology"` → `"Forensic
Medicine"`, `"Radiation Medicine"`/`"Medicine Radiotherapy"` → `"Radiation
Medicine (Nuclear Medicine)"`). Result: 27 distinct specialization
labels. Re-apply this same normalization + canonicalization map if the
source is regenerated from scratch.

**Now uses the browse+search combobox** (`CuratedCollegeSearch` +
`SearchableCombobox`), same as DNB/MD-MS — see the PG/MD-MS section
above. `web/components/MentorForm.tsx`'s `BROWSE_DEGREES` includes
`"Diploma"`.

## A casing bug worth knowing about — `Program.name` must be UPPERCASE

`UniversitiesService.findCurated` queries `Program.name: degree.toUpperCase()`.
Every seed script here must therefore store its `PROGRAM_NAME` fully
uppercase (`'DNB'`, `'MD/MS'`, `'DM/MCH'`, `'DIPLOMA'`) — a mixed-case
value like `'DM/MCh'` (this repo's actual first attempt) silently never
matches, since `"DM/MCh".toUpperCase()` is `"DM/MCH"`, not `"DM/MCh"`. A
browser-side test that mocks the fetch response instead of hitting a
really-seeded database won't catch this — it only surfaces once real data
is seeded and queried for real.

## Two more bugs caught in a final review pass (fixed, not just noted)

**College name over `University.name`'s VARCHAR(200) limit.** One
`pg-mdms-colleges.json` row's source cell listed four historical aliases
for the same institution joined by commas into a single ~250-char string
(`"E.S.I.C. Medical College & Hospital K.K. Nagar Chennai earlier known as
ESIC Medical College & PGIMSR..., ESI-PGIMSR..., ..."`). Running any seed
script against a name like that would fail outright at the DB with a
"value too long for type character varying(200)" error. Fixed by taking
just the first comma-separated segment as the canonical name across all
four datasets (only this one row was actually affected, but the fix
applies universally as a safety net).

**Same-name, different-branch collisions silently overwriting each
other's specializations.** `dnb-colleges.json` (address-keyed era) and
the first `diploma-colleges.json` refresh each had dozens of cases where
the *same* hospital name repeats in the *same* state for genuinely
different physical branches — hospital chains like "Ankura Hospital" (4
distinct Telangana locations) and generic government-hospital names like
"Area Hospital" (reused across many Andhra Pradesh towns).
`seed-dnb-colleges.mjs` and `seed-diploma-colleges.mjs` originally
tracked newly-created rows in the *same* name+state map used for
matching pre-existing DB rows — so the second branch in a pair would
"match" the row the first branch had just created moments earlier in the
same run, and its Program upsert would silently overwrite the first
branch's specializations rather than creating its own row. First fix:
tracked within-run creations separately, keyed by name+state+address,
while still matching *pre-existing* DB rows by name+state only.

**That first fix turned out to be incomplete — it only protected
against collisions among rows created within the same run, not against
multiple genuinely distinct rows that already existed in the DB from an
earlier address-keyed seeding.** A DNB re-seed onto the new
district-keyed `dnb-colleges.json` surfaced this for real: several
name+state groups had multiple real pre-existing branch rows, and since
`existingByNameState` could only hold one candidate per key, every
district-distinct JSON entry for such a group collided onto the same
arbitrary survivor row — repeatedly overwriting its specializations and
orphaning the other branches (1,426 live DNB programs found vs. 1,378
correct). Fixed properly in both `seed-dnb-colleges.mjs` and
`seed-diploma-colleges.mjs`: `existingByNameState` now holds *every*
pre-existing candidate per key, and a `claimed` set tracks which one an
earlier JSON entry in the same run already reused, so a later entry with
the same name+state can no longer steal it. Remediated on the real DB by
deactivating all DNB Program rows and re-seeding fresh — verified back to
exactly 1,378 active rows. The seed scripts' upsert `update` clause also
now sets `isActive: true` (a related bug found during that remediation:
without it, a row revived by a re-seed after being deactivated stayed
inactive even though it was correctly matched and updated).

`diploma-colleges.json`'s second refresh has no address/district column
at all (see above) — colliding rows there are a deliberate merge-by-
name+state decision, not a bug, so this fix mainly matters for exact
duplicate (name, state) entries appearing twice in the JSON itself.
`pg-mdms-colleges.json` and `dm-mch-colleges.json` have no address column
to key by and had zero name+state collisions in the current data, so they
were left as-is.

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
