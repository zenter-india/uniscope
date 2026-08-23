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

**Second refresh (`DNB_Accreditation_Clean_with_PIN.xlsx`, same "Clean
Data" shape plus a PIN Code column, unused here).** 98 distinct
specialization labels — an exact match to the source's own "By
Specialization" sheet count, no typos found. The `"DNB- "` prefix was
initially stripped to match the plain-name convention every other DNB
refresh used, but restored per explicit user request to match the
source verbatim (e.g. `"DNB- Anaesthesiology"`, not `"Anaesthesiology"`)
— this dataset's specialization convention is now inconsistent with
MD/MS/Diploma/DM-MCh's plain-name style, a deliberate exception, not an
oversight. A few
specializations have a distinct `"(Direct 6 Years Course)"` variant
alongside the base name (e.g. `"Neuro Surgery"` vs `"Neuro Surgery
(Direct 6 Years Course)"`) — both have substantial independent record
counts (not one clearly the "real" entry and one noise), so kept as
separate entries rather than merged, unlike the DM/MCh refresh's
duration-suffix cleanup where the base form dominated.

**The `College` column in this export is noticeably less clean than the
first refresh's — 587 of 5,379 rows have a locality/address fragment
appended after a comma** (e.g. `"State Hospital, Dharampur Garden Road,
Dharampur"` where the first refresh's source just had `"State
Hospital"`), not consistently matching the separate `District` column
closely enough to detect and strip surgically. **First attempt at
regenerating this file didn't account for that** — grouping used the
full (unstripped) `College` text, and a diff against the prior refresh's
file caught it: 168 (name, state) keys existed only in the new file, and
161 of those matched an already-known college once truncated to the
first comma segment — i.e. the same real hospitals, just about to get
duplicate University rows because of the address text bleeding into the
name field, not 168 genuinely new colleges. Fixed by truncating every
`College` value at its first comma (not just the >200-char safety net
this file's `College` values never actually hit) before grouping — this
dropped the "only in new file" count to a much more plausible 47.
**1,375** unique (name, district, state) institutions. Two case-variant
name collisions still caught by grouping on the normalized
(lowercase+trim) key, same lesson as the diploma refresh. No seed script
changes needed — the existing `claimed`-set + `isActive: true` fixes
already cover this refresh.

Worth remembering for the *next* DNB refresh: **check whether this
comma-truncation is still needed, or whether a future export goes back
to clean plain names** — don't assume this file's shape carries forward
unchanged; check for it explicitly (diff a sample of `(name, state)`
keys against the prior refresh before seeding) rather than assuming.

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

**Updated three times now.** First refresh (still 8 columns, same "Course
Name" combining degree+specialty): 9,279 course records (up from 8,327),
649 unique institutions (up from 568), same parsing/grouping/length-fix
pipeline. Second refresh came from a differently-shaped export
(`NMC_PG_Seats_2025-26.xlsx`, sheet "PG Seats Data") — `Specialization` is
already its own column here, formatted as `"MD - <specialty>"` /
`"MS - <specialty>"` (no need to *construct* that prefix from a combined
Course Name field the way the first refresh did), plus a `Management`
column same as before: 9,395 records, 653 unique institutions.

**Third refresh (`NMC_PG_Seats_2025-26 (1).xlsx`, same "PG Seats Data"
sheet shape)** dropped from 653 to 645 unique (College Name, State)
groups: 9,284 non-blank records (110 fully-blank padding rows at the
sheet's end dropped), then 8 further rows dropped for scrambled
OCR-garbled text (an institute name — "TRIHMS, Naharlagun" — folded into
the Specialization field, unrecoverable), and 24 rows dropped for having
no MD/MS prefix at all (PG Diploma courses like `"DOMS"`/`"DIP.
ANAESTHESIOLOGY"`, same out-of-scope treatment as the first refresh's 12
dropped Diploma rows). Net: 343 GOVERNMENT / 302 PRIVATE (previously 350/
303) via the same lenient "strip non-letters, check for govt/govern as a
substring" ownership detection — a couple of new `Management` spellings
showed up this refresh (`"Society Govt.- Society"`, `"Trust (Private )"`)
and both classify correctly under the existing lenient check.

**This refresh's raw `Specialization` text was the messiest of any
dataset here — 352 distinct raw strings for what turned out to be 38 real
specialties.** Cleaned in stages: (1) normalize a stray en-dash separator
to a plain hyphen, (2) parse the `MD`/`MS` prefix via a regex tolerant of
punctuation/spacing variants (`"MD-X"`, `"M.D. X"`, `"MD - X"`, …), (3) an
explicit typo-fix map for ~25 misspellings (`"Ceneral Medicine"` →
`"General Medicine"`, `"Micrology"` → `"Microbiology"`, `"Psychaitry"` →
`"Psychiatry"`, etc.) and a few malformed fragments (`"/MS - Anatomy"` →
`"Anatomy"`), (4) reclassify a handful of rows whose stated prefix
contradicts this taxonomy's convention (Ophthalmology/Obstetrics &
Gynaecology/Orthopaedics/General Surgery/OBG are always MS here, Anatomy
is always MD — a few rows had the wrong one), (5) normalize
British/American spelling pairs (paediatric/pediatric,
anaesthes-/anesthes-, gynaecolog-/gynecolog-, haematolog-/hematolog-,
orthopaed-/orthoped-, ophthalmolog-/opthalmolog-) before grouping, (6) an
explicit equivalence map merging abbreviations and multi-name specialties
onto one canonical bucket (ENT ≡ Otorhinolaryngology, OBG ≡ Obstetrics &
Gynaecology, DVL ≡ Dermatology/Venereology/Leprosy, PSM ≡ Community
Medicine, Radiology ≡ Radio Diagnosis, Radiotherapy ≡ Radiation Oncology,
Forensic Medicine ≡ …& Toxicology, Respiratory/Pulmonary/TB-RD Medicine ≡
one bucket, PMR ≡ Physical Medicine & Rehabilitation, the various
Immuno(-)Haematology/Hematology/Transfusion Medicine spellings ≡ one
bucket, Anaesthesia ≡ Anaesthesiology). The canonical display spelling
for each bucket is whichever raw variant occurred most often, not a
hand-picked "correct" one. A few genuinely-distinct-looking niche
specialties (Aviation Medicine, Bio-Physics, Tropical Medicine, Community
Health Administration, Traumatology & Surgery, Lab Medicine) were
deliberately left unmerged rather than guessed into a larger bucket —
only merges with reasonably clear justification were made; re-check git
history for the exact map before extending it. Grouped using the same
normalized (lowercase+trim) key the seed script matches on, per the
diploma refresh's 746-vs-735 lesson.

Regenerate the same way (adjusting the parse step to match whichever
column layout the new file actually has, and expect to re-review the
specialization cleanup maps against whatever new typos/variants show up)
if a further-updated version shows up.

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

Input to `../seed-dm-mch-colleges.mjs`. Source: NMC's public
"Super-Specialty Seat Matrix" notice, grouped to one entry per (College
Name, District, State) with its distinct `specializations` list. Own
dataset — not merged with PG/MD-MS/Doctorate.

**Two prior versions used College+State-only grouping and an OCR'd
Management column** (garbled Course Name/State text, ownership detected
via lenient "contains govt/govern" substring check) — see git history if
that writeup is ever needed again.

**Third refresh (`DM_MCh_SuperSpeciality_Clean.xlsx`, sheet "Clean
Data") is a different shape entirely**: S.No/College/District/State/
Specialization, matching the DNB/Diploma "Clean Data" format rather than
the old seat-matrix format. 1,356 records, 221 unique (College, District,
State) groups. **Adds a District column** (the prior versions didn't have
one) — same as the DNB refresh, this enables real branch disambiguation
via the district-aware `claimed`-set matching in `seed-dm-mch-colleges.mjs`
(see that file's header comment), rather than DM/MCh needing the
name+state-only merge Diploma was stuck with. **No ownership/management
column this time** — `type` now defaults to PRIVATE like DNB/Diploma,
losing the real GOVERNMENT/PRIVATE split the prior two versions had.

**Specialization labels heavily normalized** — this source's raw labels
were the messiest of any dataset here: inconsistent `"DM - X"` / `"M.Ch -
X"` / `"M. Ch - X"` / `"MCh X"` prefix formatting (including an en-dash
`–` used as the separator in two rows), real typos (`"Thorasic Surgery"`,
`"Geriatic Mental Health"`, `"Neuro Anasthesia"`), a stray leading `"m "`
typo on one row, duration-suffix duplicates (`"Neuro Surgery(3 years)"` /
`"(6 years)"`), and spelling/verbosity variants of the same specialty
(`"Pediatric"` vs `"Paediatric"`, `"Urology"` vs `"Urology/Genito -
Urinary Surgery"`, three different Plastic Surgery phrasings). Cleaned in
two passes: (1) strip the degree-type prefix via regex (handles all the
punctuation/spacing/case variants), (2) an explicit canonicalization map
for the ~20 remaining near-duplicate spellings/typos. Result: 47 distinct
specialization labels, no "DM -"/"MCh -" prefix (matches the DNB/Diploma
plain-name convention — unlike the prior version of this file, which
deliberately kept the prefix "transcribed as-is"). Some judgment calls
here are genuinely debatable (e.g. merging "Pulmonary Medicine" and
"Pulmonology" was considered but *not* done, since unlike the obvious
prefix/typo cases there's no way to verify from the data alone whether
they're the same NBE-recognized specialty or two distinct ones) — see
git history for the exact canonicalization map if a future refresh needs
revisiting.

**Grouped using the same normalized (lowercase+trim) key the seed script
matches on** — learned from the diploma refresh's 746-vs-735 bug that
exact-string grouping here can silently diverge from the script's
normalized matching. No case/whitespace collisions found in this
dataset, but the key is normalized regardless as a safety net.

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

**746 → 735: a real data-generation bug, found by a live-DB mismatch,
not a prod duplicate-row issue.** The first version of this file grouped
raw rows into one entry per (College, State) using an *exact* string
match — but the seed script matches existing DB rows using a
*normalized* (lowercased, trimmed) key. 11 colleges appear in the raw
source under two different castings of the same name (e.g. `"DISTRICT
HOSPITAL"` and `"District Hospital"` both under Punjab) — exact-match
grouping kept these as two separate JSON entries, which the seed script
then silently collapsed onto the same University row at write time
(second entry's Program upsert overwrote the first's), landing at 735
active rows against an expected 746. Fixed by grouping with the same
normalized key the seed script uses, so these merge properly (specializations
combined) at generation time instead of colliding at write time — 735 is
the correct count. Worth remembering for any future dataset here:
**grouping key at generation time must match the seed script's matching
key exactly**, including case/whitespace normalization, or a silent
collision like this can happen again.

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
`dm-mch-colleges.json`'s third refresh gained a District column (see
above) and got the same district-aware `claimed`-set fix applied
proactively before its first seed run against prod, rather than
discovering the same bug again after the fact. `pg-mdms-colleges.json`'s
third refresh got the non-district-aware version of the same fix (a
`claimed` set without location disambiguation, same treatment as
`diploma-colleges.json` — this source has no address/district column
either) applied proactively for the same reason, plus `isActive: true`
on upsert.

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
