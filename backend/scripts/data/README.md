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

**Third refresh (`Diploma_Institutions_Clean (1).xlsx`, same "Clean
Data" shape) brings District back** — reversing the second refresh's
loss of location detail, matching what happened with DNB around the
same time. 830 unique (College, District, State) institutions (matches
the source's own "Unique Colleges" sheet count exactly), grouped and
branch-disambiguated the same way `dnb-colleges.json` is: normalized
grouping key at generation time (diploma refresh #2's own lesson),
first-comma name truncation for address bleed (DNB refresh #2's
lesson — this source has the same issue, e.g. `"Sadar Hospital,
Madhepura"` where `"Madhepura"` duplicates the District column), and
`seed-diploma-colleges.mjs` upgraded from name+state-only matching to
the full district-aware `claimed`-set matching `seed-dnb-colleges.mjs`
uses (name+state+district branch key, `Program.description` carries the
district). Spot-checked the resulting (name, state) duplicate groups
the same way as DNB's: the overwhelming majority (38 of 39) are
genuinely distinct branches in different real districts (e.g. "District
Hospital, Karnataka" correctly split across 8 real districts); one
false-positive slipped through (`"Rural Development Trust Hospital,
Andhra Pradesh"` under `"Anantapur"` vs `"Ananthapuramu"` — the same
district under its old and renamed spelling) and was left unmerged
rather than guessed at — fixing that class of issue generally would
need a canonical Indian-district-renaming lookup, out of scope here.

**Specialization labels: 38 raw → 27 after canonicalization, `"(NBEMS)"`
suffix kept intact this time** (earlier refreshes stripped it; per
explicit user request it's now preserved verbatim wherever the source
has it, e.g. `"Paediatrics - DCH (NBEMS)"`, not `"Paediatrics - DCH"`).
Same "Diploma in X" vs "X - CODE (NBEMS)" mixed-format problem as the
first refresh, but this time *both* forms coexist for many specialties
within the same file (not cleanly non-overlapping like before) — e.g.
`"ENT"` (1 row) and `"ENT - DLO (NBEMS)"` (76 rows) are the same
specialty labeled two ways. Canonicalized to whichever form is more
common per specialty (`"Anaesthesia"` → `"Anaesthesiology - DA
(NBEMS)"`, `"Ophthalmology"` → `"Ophthalmology - DO (NBEMS)"`,
`"Obstetrics & Gynaecology"` → `"Obstetrics and Gynaecology - DGO
(NBEMS)"`, `"ENT"` → `"ENT - DLO (NBEMS)"`, `"Tuberculosis & Chest
Diseases"` → `"...Disease - DTCD (NBEMS)"`, `"Paediatrics"` →
`"Paediatrics - DCH (NBEMS)"`, `"Radio- Diagnosis"` → `"Radio Diagnosis
- DMRD (NBEMS)"`, `"Dermatology"` → `"...Venereology and Leprosy"`
(this one and `"Community Medicine"` → `"Social & Preventive Medicine /
Community Medicine"` had no NBEMS-suffixed form to map onto — both
sides of those two merges were plain names). Re-check this map (or
extend it) if a future refresh's raw label list looks meaningfully
different.

## `bds-colleges.json` — BDS (Dental UG) colleges

Input to `../seed-bds-colleges.mjs`. Source: a clean BDS institution list
supplied directly by the user (`BDS_Colleges_Clean.xlsx`, sheet "Clean
Data"), one entry per (College Name, District, State) with a
`Management` column (`Govt.`/`Private`) mapped to `type` via the same
lenient "strip non-letters, check for govt/govern as a substring"
detection used elsewhere. **329 colleges, 60 GOVERNMENT / 269 PRIVATE.**

**The only dataset here with no specialization data at all.** BDS is
the base dental undergraduate degree, not a postgrad specialty program
— there's no NBEMS/NMC-style specialization list the way MD/MS, DNB,
DM/MCh, and Diploma each have, so this seed script only creates/updates
`University` rows (`stream: 'Dental'`, `levels: ['UG']`) — no `Program`
row at all. District goes on `University.city` (not `Program.description`
the way DNB/DM-MCh/Diploma carry it) since there's no Program to attach
it to here, and `city` is exactly what that column is for.

**The mentor form's College field for Stream=Dental uses
`CollegeSearch` with a `stream="Dental"` filter** (added to
`searchUniversities`/`CollegeSearch` — previously that component had no
stream parameter at all, since it queried `GET /universities`
unfiltered by stream), not the curated/Program-based
`CuratedCollegeSearch` pattern MD/MS/DNB/Diploma/DM-MCh use — there's no
Program-derived specialization data to browse for a Dental
degree, and BDS itself doesn't have specializations to pick from
anyway. `MentorForm.tsx`'s `STREAMS_WITH_COLLEGE_DATA` set gates which
non-Medical streams get this treatment instead of the plain free-text
fallback every other non-Medical stream still uses until their own data
is uploaded — currently just `"Dental"`.

**No address-bleed or exact-vs-normalized grouping issues found** in
this source (checked both, per the DNB/diploma refreshes' lessons) — 20
comma-containing names, all genuine institutional name components
(hospital/institute affiliations), none matching the District column's
text the way DNB's/diploma's address-bleed did.

**Known gap, found seeding this against production: 2 of 329 BDS
colleges matched a pre-existing University row under a different
stream and are invisible to a `stream = 'Dental'` filter.** See the
general "cross-stream matching gap" note near the end of this file for
the full explanation — this dataset's specific 2 rows are University
College of Medical Sciences (Delhi) and Armed Forces Medical College
(Maharashtra), both genuinely real dual Medical+Dental institutions,
both left as `stream = 'Medical'` deliberately rather than forcing a
schema change for a 0.6% edge case.

## `mds-colleges.json` — MDS (Dental PG) colleges + specializations

Input to `../seed-mds-colleges.mjs`. Source: `MDS_Colleges_Clean.xlsx`
(same provider as `bds-colleges.json`), sheet "Clean Data" — one row per
(College, District, State, Specialization). Unlike BDS, MDS is a
postgrad dental specialty program with real specialization data, so
this seed script creates/updates both `University` and a "MDS" `Program`
row per college, mirroring `seed-dnb-colleges.mjs` exactly (same
district-aware `claimed`-set matching, `Program.description` carries the
district, `isActive: true` on upsert). **287 colleges, 46 GOVERNMENT /
241 PRIVATE, 9 specializations** (`MDS Conservative Dentistry &
Endodontics`, `MDS Oral & Maxillofacial Pathology and Oral Microbiology`,
`MDS Oral Medicine & Radiology`, `MDS Oral and Maxillofacial Surgery`,
`MDS Orthodontics & Dentofacial Orthopedics`, `MDS Pediatric and
Preventive Dentistry`, `MDS Periodontology`, `MDS Prosthodontics and
Crown & Bridge`, `MDS Public Health Dentistry`) — one typo fixed
(`"Orthodonitics"` → `"Orthodontics"`), otherwise the source's own
`"MDS <Specialty>"` labels kept as-is.

**No separate ownership column in "Clean Data"** — `type` comes from
joining against this same workbook's "Colleges" sheet (329 rows, the
same sheet `bds-colleges.json` reads from) by (name, state); all 280
distinct MDS colleges matched a row there. Same lenient govt/govern
substring detection as elsewhere.

**The mentor form's College field for Stream=Dental, Degree=MDS uses
the full `CuratedCollegeSearch` browse+search pattern**, same as
Medical's MD/MS/DNB/Diploma/DM-MCh — picking a college populates the
Specialization field with that college's own specializations, falling
back to the full 9-item list only when no college matched (same
mechanism as every other curated degree). This required generalizing
`MentorForm.tsx`'s `CURATED_DEGREE_MAP` (previously Medical-only,
hardcoded `stream="Medical"` on `CuratedCollegeSearch` and in the
`fetchCuratedColleges` calls) into `CURATED_DEGREE_MAP_BY_STREAM`, keyed
by stream then degree — no backend change was needed, since
`UniversitiesService.findCurated` was already stream-agnostic
(`query.stream` was never hardcoded there). BDS stays on the plain
`CollegeSearch`+`stream` filter pattern (see above) since it has no
specialization data to browse.

**Many MDS colleges already exist as `University` rows from the BDS
seed** (same physical college, same name+state) — the district-aware
matching correctly reuses those rows and pushes `"PG"` onto their
`levels` (already `["UG"]` from BDS) rather than creating duplicates,
same as how DNB/DM-MCh/Diploma reuse UG-seeded rows.

## `btech-colleges.json` — B.Tech/B.E (Engineering UG) colleges

Input to `../seed-btech-colleges.mjs`. Source: `NBA_Colleges_Clean.xlsx`,
sheet "Clean Data" (S.No/College/District/State — no ownership/management
column at all). One entry per (College Name, District, State), `type`
defaulted to `PRIVATE` for all of them since this source has no ownership
data to derive it from (unlike BDS, which had a `Management` column).

**Like BDS, no specialization data at all.** B.Tech/B.E is the base
engineering undergraduate degree — this seed script only creates/updates
`University` rows (`stream: 'Engineering'`, `levels: ['UG']`), no
`Program` row. District goes on `University.city`, same convention as
`bds-colleges.json`.

**Refreshed once already, from a Tamil-Nadu-heavy 344-row export to a
genuinely nationwide one (`NBA_Colleges_Clean_2.xlsx`, same "Clean Data"
shape): 1,312 raw rows across 30 states/UTs → 1,256 unique (College,
District, State) colleges** (up from the first version's 316). Tamil
Nadu is still the largest single state (254), followed by Maharashtra
(186), Andhra Pradesh (130), Karnataka (126), Telangana (124) — the
first version's data is a strict subset of this one, so this file
**replaces** rather than merges with it.

**33 rows dropped for having no state at all** (matches the source's own
"No District in Source" sheet count exactly) — `University.state` is
required, so excluded rather than guessed at, same as the first
refresh's 28. One further row (`"Career Institute of Technology &
Management"`, Haryana) has a state but no district — kept, with
`University.city` left `null` for it, same as every other dataset here
handles a missing city.

**Address-bleed found and fixed again, same as the DNB/MDS lesson** — 77
of 162 comma-containing college names had the district text duplicated
after a comma in the name itself (e.g. `"JNTUA COLLEGE OF ENGINEERING,
PULIVENDULA, KADAPA"` where `District` already says `"Pulivendula,
Kadapa"`). Fixed by truncating at the first comma before grouping,
checked proactively rather than discovered after seeding.

**Normalized (lowercase+trim) grouping key used again, per the diploma
refresh's 746-vs-735 lesson** — 1,279 rows (after dropping no-state rows)
collapsed to 1,256 unique keys; the 23-row difference was almost
entirely case-variant duplicates of the same college (e.g. `"ACHARYA
INSTITUTE OF TECHNOLOGY"` vs `"Acharya Institute of Technology"`, both
Bangalore, Karnataka) plus a few comma-bleed variants of the same
college now correctly merging after the truncation fix above (e.g.
`"KARUNYA INSTITUTE OF TECHNOLOGY"` and `"KARUNYA INSTITUTE OF
TECHNOLOGY, COIMBATORE"`) — first-seen casing kept as canonical, same
convention as the DNB refresh. No name over `University.name`'s
VARCHAR(200) limit.

**One state name normalized for consistency**: the source's `"Andaman
and Nicobar"` (1 row) was expanded to `"Andaman and Nicobar Islands"` to
match the full official name used elsewhere in the app (`INDIAN_STATES`
in `web/lib/options.ts`) — this doesn't affect matching/search logic
(University.state is free text, not gated to that list), just display
consistency.

Seed script itself needed no changes for this refresh — the existing
district-aware `claimed`-set matching in `seed-btech-colleges.mjs`
already handles the larger dataset the same way it did the smaller one.

**The mentor form's College field for Stream=Engineering uses
`CollegeSearch` with a `stream="Engineering"` filter** — same pattern as
Dental/BDS. `MentorForm.tsx`'s `STREAMS_WITH_COLLEGE_DATA` set now
includes `"Engineering"` alongside `"Dental"`.

**Unlike BDS, the Specialization field is still shown for
Stream=Engineering — just empty/disabled ("Coming soon"), pending a
future specialization dataset upload.** This is a genuinely new gating
mechanism, `STREAMS_WITH_EMPTY_SPECIALIZATION`, distinct from
`hasCuratedData` (which governs both whether the field renders *and*
whether it's required/submitted): Engineering isn't in
`CURATED_DEGREE_MAP_BY_STREAM` at all, so `hasCuratedData` stays `false`
for it (matching BDS — no specialization required at submit time, none
sent in the payload), but the field still renders as a disabled
placeholder so mentors can see it's coming rather than it being wholly
absent the way it is for BDS.

**Seeded against production: 1,256 total, all newly created (0
matched) — but `stream = 'Engineering'` returns 1,257.** The extra row
is unrelated to this dataset: a pre-existing "IIT Bombay" University
row (created ~4 weeks before this seed run, from earlier generic seed
data) already had `stream = 'Engineering'` set. Verified directly
against `btech-colleges.json` — IIT Bombay doesn't appear in it at all,
under any spelling — this AICTE-style dataset covers private/
state-affiliated engineering colleges, not the IIT system, so this
isn't a match-miss bug, just an unrelated pre-existing row inflating
the count by 1. Left as-is.

## `pg-engineering-colleges.json` — M.Tech/M.E (Engineering PG) colleges

Input to `../seed-pg-engineering-colleges.mjs`. Source:
`PG_Engineering_Colleges_Clean.xlsx`, same "Clean Data" shape as
`btech-colleges.json` (S.No/College/District/State — no ownership
column). **116 raw rows → 114 unique (College, District, State)
colleges**, `type` defaulted to `PRIVATE` for the same reason as
`btech-colleges.json`.

**No specialization data, same as B.Tech.** M.Tech/M.E is still the
base engineering postgraduate degree here — no NBA/AICTE-style
specialization list came with this source — so this seed script only
creates/updates `University` rows, no `Program` row.

**6 rows dropped for having no state at all** (matches the source's own
"No District in Source" sheet count). District goes on `University.city`.

**Address-bleed fixed, same lesson as `btech-colleges.json`** — 17 of 26
comma-containing names had district text duplicated after the comma.
**One additional wrinkle this source needed that `btech-colleges.json`
didn't**: several names have a `"(Formerly ...)"` / `"(Erstwhile ...)"`
parenthetical aside that itself contains a comma (e.g. `"National
Institute of Technology (Formerly Regional Engineering College,
Kurukshetra)"`) — naive first-comma truncation would cut mid-
parenthetical and leave an unbalanced `"("`. Fixed by stripping all
`"(...)"` parenthetical groups *before* truncating at the first
remaining comma, rather than truncating first.

**One explicit name override** for a single row whose real legal name
itself contains commas that aren't address bleed (`"Shanmugha Arts,
Science, Technology & Research Academy (SASTRA) Deemed to be
University, (Erstwhile Shanmugha College of Engineering)"` — blind
truncation would have produced the nonsensical `"Shanmugha Arts"`).
Kept as `"Shanmugha Arts, Science, Technology & Research Academy
(SASTRA) Deemed to be University"` (dropping only the erstwhile-name
parenthetical) via a one-off override map in the generation script,
same convention as the PG/MD-MS dataset's one-off garbled-name and
over-length-name fixes.

**Many of these colleges already exist as `University` rows from the
B.Tech seed** (same physical college now also offering a PG program) —
the district-aware `claimed`-set matching correctly reuses those rows
and pushes `"PG"` onto their `levels` (already `["UG"]`) rather than
creating duplicates, same pattern as MDS reusing BDS-seeded rows.
`seed-pg-engineering-colleges.mjs` mirrors `seed-btech-colleges.mjs`
exactly except for this: it adds `"PG"` (not `"UG"`) to `levels`, and
creates new rows with `levels: ['PG']` when no B.Tech row exists yet.

**No frontend changes needed.** `MentorForm.tsx`'s
`STREAMS_WITH_COLLEGE_DATA` and `STREAMS_WITH_EMPTY_SPECIALIZATION` sets
are gated by `form.stream` (`"Engineering"`), not by degree — so
M.Tech/M.E automatically gets the same real `CollegeSearch` (stream
filter) and disabled "Coming soon" Specialization field that B.Tech/B.E
already has, with zero code changes.

## `diploma-engineering-colleges.json` — Diploma Engineering (polytechnic) colleges

Input to `../seed-diploma-engineering-colleges.mjs`. Source:
`Diploma_Engineering_Colleges_Clean.xlsx`, same "Clean Data" shape as
`btech-colleges.json` (S.No/College/District/State — no ownership
column). **370 raw rows → 366 after dropping 4 no-state rows → 364
unique (College, District, State) colleges**, `type` defaulted to
`PRIVATE`. No specialization data, same as B.Tech/M.Tech — University
rows only, no `Program` row.

**A different, stricter comma-truncation rule than every prior
Engineering/Law dataset was needed here — truncate only when the
comma tail literally matches the District column's text, not merely
when it "looks like" a locality.** This source has a pattern the
others didn't: dozens of colleges share the exact generic name
`"Government Polytechnic"` (or `"Government Polytechnic for Women"`),
and the only thing distinguishing multiple real, distinct polytechnics
within the *same district* is a **town name** appended after a comma
(e.g. `"GOVERNMENT POLYTECHNIC, KALYANDURG"` and `"GOVERNMENT
POLYTECHNIC, JAMMALAMADUGU"` are two different real colleges, both in
Andhra Pradesh's Cuddapah-adjacent districts, both reduced to the exact
same generic name if truncated) — the town isn't in the District
column at all, so it's the *only* disambiguating text available, not
address bleed. **First attempt used the Law datasets' locality-word-count
heuristic and silently merged multiple genuinely distinct polytechnics
into one row** (caught before generating the seed script, not after
seeding — e.g. 5 different "Government Polytechnic" branches across 5
different Cuddapah-district towns would have collapsed to a single
entry). Fixed by reverting to the original DNB/BDS/B.Tech rule for this
dataset: only truncate when `district.lower() in tail.lower()` is
literally true. Two names that would have been badly mangled by the
locality heuristic are correctly kept whole under this stricter rule:
`"DKTES,TEXTILE & ENGG. INSTITUTE"` (comma separates an acronym from
its own name, not an address) and `"Polytechnic, The Maharaja Sayajirao
University of Baroda"` (already backwards-ordered, truncating would
have left just `"Polytechnic"`). Only 2 genuine duplicate pairs found
after this fix (one case-variant, one true district-match bleed) — 366
→ 364.

**Many of these colleges already exist as `University` rows from the
B.Tech/M.Tech seeds** — the district-aware `claimed`-set matching
reuses those rows and pushes a new `"Diploma"` value onto `levels`
rather than creating duplicates, same pattern as PG reusing UG rows
elsewhere. This is also the **first dataset to add anything other than
`"UG"`/`"PG"` to `University.levels`** — the column is a free-form
string array, not an enum (see its doc comment in `schema.prisma`), so
`"Diploma"` is a valid value; nothing elsewhere reads `levels` in a way
that would break from a third distinct value.

**No frontend changes needed** — `"Diploma"` was already added as an
Engineering degree option (`DEGREES_BY_STREAM.Engineering` in
`web/lib/options.ts`) before this dataset existed, and
`STREAMS_WITH_COLLEGE_DATA`/`STREAMS_WITH_EMPTY_SPECIALIZATION` are
stream-gated, not degree-gated — so Diploma already had the real
`CollegeSearch` and disabled Specialization placeholder, just searching
the combined B.Tech+M.Tech list until this dataset was seeded.

**Seeded against production: 364 total (13 matched existing + 351
created), and all 364 satisfy `stream = 'Engineering' AND 'Diploma' =
ANY(levels)`** — no cross-stream overlap this time (all 13 matched
rows were already `stream = 'Engineering'` from the B.Tech/M.Tech
seeds), unlike BDS/UG-Law/PG-Law's shortfalls (see the general
cross-stream matching note near the end of this file).

## `law-ug-colleges.json` — UG Law (B.A. LL.B. / LL.B. / integrated) colleges

Input to `../seed-law-ug-colleges.mjs`. Source:
`UG_Law_Programmes_Clean.xlsx`, sheet **"Unique Colleges"** — a
different shape from every other dataset here: this workbook's raw
"Clean Data" sheet is AISHE programme-level data (3,250 rows, one row
per College×Programme×Level×Mode — 10 distinct UG/Integrated Law
programme names like `"B.A. L.L.B."`, `"L.L.B."`, `"B.B.A-L.L.B."`),
already pre-collapsed by the source into a "Unique Colleges" sheet
(College Name/District/State/Programmes Offered count) — used directly
rather than re-deriving the college list from the programme-level rows
ourselves. **2,085 raw unique-college rows → 2,083 after normalized-key
dedup**, `type` defaulted to `PRIVATE` (no ownership column, same as
the two Engineering datasets).

**No specialization data, no `Program` row** — same as BDS/B.Tech/
M.Tech/M.E. `stream: 'Law'`, `levels: ['UG']`.

**This source's raw college names are noticeably messier than the
NBA/NBEMS "Clean Data"-style exports used elsewhere** — many are raw
AISHE names with embedded street addresses, PIN codes, and
trust/society name prefixes, not a clean pre-truncated college name.
Blind first-comma truncation (the rule used for every dataset above)
would have badly mangled a meaningful number of these — e.g.
`"Institute of Law, Nirma University"` → `"Institute of Law"` (a real,
specific, well-known law school reduced to an unhelpfully generic
name) or `"MIT Art, Design and Technology University, Pune"` →
`"MIT Art"`.

**A different, more conservative truncation rule was used for this
dataset instead**: after stripping `"(...)"` parenthetical asides (as
usual), only truncate at the first comma if the text *after* it looks
like a bare locality — at most 4 words, none of them a common
institutional/connector word (`and`, `&`, `of`, `for`, `college`,
`university`, `institute`, `school`, `society`, `trust`, `foundation`,
`science`, `technology`, `law`, etc.). A tail that fails this check
(e.g. `"Design and Technology University, Pune"`, `"Arts & Science"`)
means the comma is very likely part of the real name or a multi-part
address, not a bare trailing locality — so the **full name is kept
as-is** rather than guessed at, consistent with this whole file's
"don't guess, keep the safer option" principle. Of 914 comma-containing
raw names, 823 were truncated (locality tail) and 91 were kept in full.
This is a real tradeoff: some kept-in-full names still carry a messy
embedded street address (e.g. `"Kishinchand Chellaram Law College, 123,
Dinshaw Wachha Road, ... Churchgate, Mumbai - 400 020"`) rather than
being cleanly reduced — accepted as the lesser risk versus mangling a
real name, and worth a manual pass if this file needs a cleaner
re-export in future.

**Only 2 normalized-key duplicate pairs found** (both legitimate merges
of a full-address entry and a shorter/generic entry for the same real
college, e.g. `"Government Law College, Salgame Road, Hassan"` merging
with `"Government Law College, Holenarasipura"` under the same
district) — no case-variant collisions otherwise.

**One state name normalized for consistency**, same as the Engineering
refresh: the source's `"The Dadra and Nagar Haveli and Daman and Diu"`
(1 row) had its leading `"The "` stripped to match `INDIAN_STATES`'
`"Dadra and Nagar Haveli and Daman and Diu"`.

**The mentor form's College field for Stream=Law uses `CollegeSearch`
with a `stream="Law"` filter** — same pattern as Dental/BDS and
Engineering. `MentorForm.tsx`'s `STREAMS_WITH_COLLEGE_DATA` set now
includes `"Law"`. **Unlike Engineering, no Specialization field is
shown at all for Law** (not added to `STREAMS_WITH_EMPTY_SPECIALIZATION`)
— per explicit request this refresh, matching BDS's "field doesn't
exist" treatment rather than Engineering's "empty placeholder"
treatment; both are legitimate per-stream choices the same gating
mechanism supports. Law's `Degree` dropdown wasn't given its own
`DEGREES_BY_STREAM` entry — it already falls back to
`DEFAULT_NON_MEDICAL_DEGREES` (`UG`/`PG`/`Doctorate`/`Others`), and this
dataset is UG-only, so no options-list change was needed either.

**Seeded against production: 2,083 total (12 matched existing + 2,071
created), but only 2,072 satisfy `stream = 'Law'`** — 11 of the 12
matched rows are the cross-stream matching gap (see the general note
near the end of this file), colleges that already existed under a
different stream and stayed there. Left as-is, same as BDS's 2.

## `pg-law-colleges.json` — PG Law (LL.M. / M.L.) colleges

Input to `../seed-pg-law-colleges.mjs`. Source:
`PG_Law_Programmes_Clean.xlsx`, same shape/pipeline as
`law-ug-colleges.json` — a "Clean Data" AISHE programme-level sheet (867
rows, 2 programme names: `"L.L.M.-Master of Law"` / `"M.L.-Master of
Laws"`, `Level` always `"Post Graduate"`) pre-collapsed by the source
into a **"Unique Colleges"** sheet (806 rows), used directly. `type`
defaulted to `PRIVATE`, same as every other no-ownership-column dataset
here.

**Same conservative locality-only comma-truncation rule as
`law-ug-colleges.json`** (parenthetical asides stripped first, then
truncate only if the comma tail is a bare ≤4-word locality with no
institutional/connector words) — this source has the same messy raw
AISHE-name character as the UG Law export (embedded addresses,
trust/society name prefixes). 417 of 806 names had a comma; 389
truncated, 28 kept in full for the same reasons as UG Law (e.g.
`"Institute of Law, Nirma University"` kept whole rather than reduced
to `"Institute of Law"`).

**No duplicates at all after normalized-key grouping** — 806 raw rows
→ 806 unique (College, District, State), no case-variant or
address-bleed collisions found. No name over `University.name`'s
VARCHAR(200) limit. No state-name normalization needed this time (all
31 raw state values already match `INDIAN_STATES` verbatim, unlike the
Engineering refresh and UG Law's one `"The Dadra and Nagar Haveli..."`
fix).

**Many of these colleges already exist as `University` rows from the
UG Law seed** (same physical college now also offering a PG program) —
`seed-pg-law-colleges.mjs` mirrors `seed-pg-engineering-colleges.mjs`
exactly: the district-aware `claimed`-set matching reuses those rows
and pushes `"PG"` onto their `levels` (already `["UG"]`) rather than
creating duplicates, and creates new rows with `levels: ['PG']` when no
UG Law row exists yet.

**No frontend changes needed**, same reasoning as M.Tech/M.E: `Law` was
already in `STREAMS_WITH_COLLEGE_DATA` (added for UG Law) and gated by
stream, not degree, and `"PG"` was already a valid Law degree option
via the `DEFAULT_NON_MEDICAL_DEGREES` fallback. No Specialization field
for Law/PG either, same as Law/UG (not requested).

**Seeded against production: 806 total (733 matched existing + 73
created), but only 796 satisfy `stream = 'Law' AND 'PG' = ANY(levels)`**
— 733 matched the UG-Law-seeded rows as expected (`PG` correctly added
to `levels` for 729 of them), but 10 of those matches are the
cross-stream matching gap (see the general note near the end of this
file). Left as-is, same as BDS/UG-Law.

## `ENGINEERING_SPECIALIZATIONS` / `PG_ENGINEERING_SPECIALIZATIONS` — Engineering specialization picklists (frontend-only, no seed script)

Unlike every dataset above, these aren't college lists and have no
seed script — each is a flat picklist of specialization *names*, not
tied to any specific college.

- `ENGINEERING_SPECIALIZATIONS` (B.Tech/B.E): source
  `NBA_Specializations_List.xlsx`, 148 rows, no duplicates.
- `PG_ENGINEERING_SPECIALIZATIONS` (M.Tech/M.E): source
  `PG_Engineering_Specializations_List.xlsx`, 283 rows, no duplicates.
  Added in a follow-up upload after B.Tech's list.

Both live in `web/lib/options.ts` (right after `MEDICAL_SPECIALIZATIONS`)
and are wired into `MentorForm.tsx` via `FLAT_SPECIALIZATION_LISTS:
Record<stream, Record<degree, string[]>>`:
```
Engineering: {
  "B.Tech/B.E": ENGINEERING_SPECIALIZATIONS,
  "M.Tech/M.E": PG_ENGINEERING_SPECIALIZATIONS,
}
```

**Same UX as Medical's Doctorate/Others treatment of
`MEDICAL_SPECIALIZATIONS`** — a `SearchableCombobox` lets the mentor
browse/search the list or type one that isn't in it (the component
already supports free text via `onChange`, no extra work needed
there). This is a different mechanism from the curated per-college
specialization data (`CURATED_DEGREE_MAP_BY_STREAM`, `BROWSE_DEGREES`)
— there's no "which college offers which specialization" mapping
here, just one flat list per degree, same as Medical's Doctorate/
Others.

**Diploma and Engineering's Doctorate/Others still show the disabled
"Coming soon" placeholder** from `STREAMS_WITH_EMPTY_SPECIALIZATION`,
pending their own lists. `FLAT_SPECIALIZATION_LISTS` takes priority
over that placeholder for whichever degree it lists — extend it the
same way (add a `Record<degree, string[]>` entry under the stream)
when a list for another degree arrives.

`hasFlatSpecializationList` is OR'd alongside `hasCuratedData`
everywhere specialization used to be gated solely by the latter
(validation's required check, the submit payload) — so both
B.Tech/B.E's and M.Tech/M.E's specialization are required at submit
time and included in the payload, same as every curated-data degree,
unlike the still-optional/still-`undefined`-in-payload empty-
placeholder degrees.

Verified live in browser for both: B.Tech/B.E shows all 148 options,
M.Tech/M.E shows all 283, both filter while typing and accept a typed
value not in the list (`onChange` fires with the raw text); Diploma
(not in the map) still shows the disabled placeholder, confirming no
regression each time a new degree was added.

## A real bug found and fixed — `STREAMS_WITH_COLLEGE_DATA`'s College field never filtered by level

Found via a direct user question ("does every degree in Engineering
use the same college data, or different — I gave different files").
It didn't: **every degree within Dental, Engineering, or Law was
searching the exact same combined pool of colleges for that stream**,
regardless of which degree was selected — `CollegeSearch` was only
ever called with `stream={form.stream}`, never a `level` filter, even
though the component and the backend (`UniversitiesService.findAll`'s
`levels: { has: query.level }`) both already fully supported one (used
for Medical's UG-only filter since early in this session). This wasn't
a deliberate design choice — the code was written when each stream had
only one dataset (BDS-only, B.Tech-only) and just never got updated as
more degree-specific datasets were added on top.

**Fixed with `COLLEGE_SEARCH_LEVEL_MAP: Record<stream, Record<degree,
level>>`** in `MentorForm.tsx`, passed as `CollegeSearch`'s `level`
prop:
```
Dental: { BDS: "UG" },
Engineering: { "B.Tech/B.E": "UG", "M.Tech/M.E": "PG", Diploma: "Diploma" },
Law: { UG: "UG", PG: "PG" },
```
A degree not listed (Doctorate/Others — no dataset of its own) falls
back to the unfiltered combined list, same as before this fix — that
part was and still is correct, since there's genuinely nothing more
specific to filter to for those two catch-all degrees.

**Verified live, comparing College field result counts by degree**
(Engineering): B.Tech/B.E → 1,259 (real B.Tech pool), M.Tech/M.E → 117
(real M.Tech pool, was previously showing B.Tech's colleges too),
Diploma → 364 (exact match to its seeded count), Doctorate → 1,659
(full combined pool, correctly unfiltered/unchanged). Before this fix
every one of those four would have shown 1,659.

## A recurring gap worth knowing about — cross-stream University matching never reclassifies `stream`

`University.stream` is a single scalar column, not an array. Every
seed script here matches an incoming college to a pre-existing
`University` row by **name+state only** (not stream) — this is
correct and necessary, since it's what prevents creating duplicate
rows for the same real-world institution across datasets. But when
the matched row was originally created by a *different* stream's seed
script, only the `create` branch ever sets `stream`; the `update`
branch (the one that runs on a match) only ever touches `levels`
(pushing `UG`/`PG`) — it never reclassifies `stream` to the matching
degree's own stream. So a real institution that legitimately spans two
streams (a Medical college that also runs a Dental program; a college
that shows up in both an Engineering-adjacent list and a Law list)
keeps whichever stream its *first-ever* seed run gave it, and becomes
invisible to a strict `stream = '<other>'` filter even though it now
correctly carries that other stream's program/level data.

**Found and deliberately left as-is three times so far** (see each
dataset's own section above for the specific counts and colleges):
BDS (2 of 329), UG Law (11 of 2,083), PG Law (10 of 806). Each case:
verified via direct cross-reference against the source JSON (never
assumed from a "matched" count alone) that the shortfall is a genuine
cross-stream overlap, not a data-quality or matching-key bug. Not
fixed because the real fix — `University.stream` → an array, or a
separate per-stream junction table — means touching every backend
query that filters by `stream`, the mobile stream picklists, and every
seed script in this file, for what has consistently been under 1% of
each dataset. Worth revisiting for real if this fraction grows
meaningfully as more datasets are added, or if a future stream's data
turns out to overlap far more with an existing one (e.g. a
Commerce & Business dataset would likely share many colleges with Law
and Arts & Humanities, given how common combined-faculty colleges are
in India).

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
