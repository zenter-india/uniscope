"use client";

import { useEffect, useState } from "react";
import { submitMentorLead, fetchCuratedColleges, fileToBase64, ApiError, type CuratedCollege } from "../lib/api";
import { CollegeSearch } from "./CollegeSearch";
import { CuratedCollegeSearch } from "./CuratedCollegeSearch";
import { SearchableCombobox } from "./SearchableCombobox";
import {
  GENDERS,
  INDIAN_STATES,
  STATE_DISTRICTS,
  STREAMS,
  DEGREES,
  DEGREES_BY_STREAM,
  DEFAULT_NON_MEDICAL_DEGREES,
  MEDICAL_SPECIALIZATIONS,
  CURRENT_STATUSES,
  LANGUAGES,
  YEARS_OF_STUDY,
  AVAILABILITY_WINDOWS,
  DOCUMENT_TYPES,
  recentYears,
} from "../lib/options";
import { useMultiStep } from "../lib/useMultiStep";
import { Field, TextInput, Select, ChipGroup, Toggle, toggleInArray, ProgressBar, ErrorText } from "./form-bits";

type FormState = {
  fullName: string;
  alias: string;
  phone: string;
  gender: string;
  state: string;
  stateOther: string;
  city: string;
  cityOther: string;
  collegeName: string;
  universityId: string;
  stream: string;
  streamOther: string;
  degree: string;
  degreeOther: string;
  specialization: string;
  currentStatus: string;
  yearOfStudy: string;
  graduationYear: string;
  yearInfoPrivate: boolean;
  languages: string[];
  languagesOther: string;
  availableDays: string[];
  documentType: string;
  documentFile: File | null;
  website: string;
};

const EMPTY: FormState = {
  fullName: "",
  alias: "",
  phone: "",
  gender: "",
  state: "",
  stateOther: "",
  city: "",
  cityOther: "",
  collegeName: "",
  universityId: "",
  stream: "",
  streamOther: "",
  degree: "",
  degreeOther: "",
  specialization: "",
  currentStatus: "",
  yearOfStudy: "",
  graduationYear: "",
  yearInfoPrivate: false,
  languages: [],
  languagesOther: "",
  availableDays: [],
  documentType: "STUDENT_ID",
  documentFile: null,
  website: "",
};

const OTHER_COLLEGE = "__OTHER__";

// Maps a selected Stream+Degree to the canonical degree value the
// curated-colleges endpoint is queried with. Medical: PG and Doctorate
// have no data of their own — NMC's source dataset is specifically
// MD/MS, so PG/MD-MS/Doctorate/Others all share it rather than staying
// empty until real PG-, Doctorate-, or Others-specific data exists.
// DM/MCh and Diploma each have their own separate NBEMS/NMC dataset, so
// neither is merged into the MD/MS bucket. UG is the only Medical-stream
// degree not listed here — it keeps the old free-text CollegeSearch +
// global specialization picklist. Dental: MDS has its own specialization
// dataset (see seed-mds-colleges.mjs); BDS has no specialization data at
// all (it's the base dental degree, not a postgrad specialty program —
// see STREAMS_WITH_COLLEGE_DATA below) so it's deliberately absent here.
export const CURATED_DEGREE_MAP_BY_STREAM: Record<string, Record<string, string>> = {
  Medical: {
    DNB: "DNB",
    PG: "MD/MS",
    "MD/MS": "MD/MS",
    Doctorate: "MD/MS",
    Others: "MD/MS",
    "DM/MCh": "DM/MCh",
    Diploma: "Diploma",
  },
  Dental: {
    MDS: "MDS",
  },
  // B.Tech/B.E, M.Tech/M.E, and Diploma all have real per-college
  // specialization data (see seed-btech-programmes-colleges.mjs /
  // seed-mtech-programmes-colleges.mjs / seed-diploma-engineering-
  // -programmes-colleges.mjs) — same curated University+Program pattern
  // as Medical/MDS, picking a college shows that college's own
  // specialization list. Doctorate and Others stay on the non-curated
  // paths (STREAMS_WITH_EMPTY_SPECIALIZATION) until/if they get their
  // own per-college specialization datasets.
  Engineering: {
    "B.Tech/B.E": "B.Tech",
    "M.Tech/M.E": "M.Tech",
    Diploma: "Diploma-Engg",
  },
  // UG and PG Law both have real per-college specialization data too
  // (Specialization column of an AISHE programme export — the specific
  // law programme type each college offers: UG's B.A. LL.B., LL.B., BBA
  // LL.B., etc.; PG's LL.M./M.L. and super-specialty like "LL.M. -
  // Constitutional Law", see seed-law-ug-programmes-colleges.mjs /
  // seed-pg-law-programmes-colleges.mjs). Doctorate and Others stay on
  // the non-curated paths until/if they get their own per-college
  // specialization datasets.
  Law: {
    UG: "Law-UG",
    PG: "Law-PG",
  },
};

// Degrees whose curated data is small/complete enough to browse in full +
// type-to-search (CuratedCollegeSearch/SearchableCombobox), rather than the
// original curated-top-30-+-"Other" pattern.
export const BROWSE_DEGREES = new Set([
  "MD/MS",
  "DNB",
  "Diploma",
  "DM/MCh",
  "MDS",
  "B.Tech",
  "M.Tech",
  "Diploma-Engg",
  "Law-UG",
  "Law-PG",
]);

// Non-Medical streams that have real seeded college data with no
// specialization concept (see seed-bds-colleges.mjs — BDS is the base
// dental degree, not a postgrad specialty) — these use CollegeSearch
// with a stream filter, same browse+search UX as Medical's UG, instead
// of the plain free-text fallback every other stream/degree combo still
// uses until their own data is uploaded. A stream+degree with curated
// specialization data (e.g. Dental+MDS, see CURATED_DEGREE_MAP_BY_STREAM)
// doesn't need to be listed here — it's handled by the curated path.
export const STREAMS_WITH_COLLEGE_DATA = new Set(["Dental", "Engineering", "Law"]);

// Maps a STREAMS_WITH_COLLEGE_DATA stream+degree to the `levels` value
// its own dataset was seeded with (see seed-btech-colleges.mjs et al —
// each pushes "UG"/"PG"/"Diploma" onto University.levels), passed as
// CollegeSearch's `level` prop so e.g. selecting Diploma only searches
// colleges that actually offer a Diploma, not the whole stream's
// combined pool (same reasoning as Medical's UG-only level filter). A
// degree not listed here (Doctorate/Others — no dataset of their own)
// falls back to the unfiltered combined list for the whole stream, same
// as before this map existed. B.Tech/B.E, M.Tech/M.E, Diploma, and both
// of Law's degrees are deliberately absent — all five moved to the
// curated CuratedCollegeSearch path above (see
// CURATED_DEGREE_MAP_BY_STREAM), which doesn't use CollegeSearch or
// this map at all.
export const COLLEGE_SEARCH_LEVEL_MAP: Record<string, Record<string, string>> = {
  Dental: { BDS: "UG" },
};

// Streams whose Specialization field falls back to a plain free-text
// input (see hasFreeTextSpecialization) for any degree with no curated
// or flat specialization dataset of its own. Originally just
// Engineering/Law/Dental (whose College field has real data via
// STREAMS_WITH_COLLEGE_DATA but not every degree has specialization
// data yet); extended to Commerce & Business, Design, and Others, then
// Arts & Humanities, per explicit request — these four have no College
// data either (plain free-text College field too, same as any other
// stream absent from STREAMS_WITH_COLLEGE_DATA), but should still
// collect a typed specialization for every degree except UG. Applies to
// every degree in
// the stream EXCEPT: (a) a degree that already has real curated data
// (hasCuratedData — e.g. Dental+MDS — guarded below so the two
// Specialization renderers never both fire for the same degree), and
// (b) whatever's in EMPTY_SPECIALIZATION_EXCLUDED_DEGREES, which — like
// BDS — has no specialization concept at all, not just "not uploaded
// yet". "UG" is degree-name-keyed rather than stream-keyed because
// every non-Medical, non-Dental, non-Engineering stream shares the same
// literal "UG" option (DEFAULT_NON_MEDICAL_DEGREES) — this is also
// consistent with Medical's own UG (MEDICAL_SPECIALIZATIONS is
// documented as "any degree except UG") and Law's UG (already excluded
// automatically since it has real curated data, never reaching this
// fallback at all) — UG having no specialization concept is already the
// rule everywhere else in this form, this just makes it explicit for
// the streams being added here too, rather than a new one. Arts &
// Humanities' UG is the one exception — see
// isExcludedSpecializationDegree's carve-out below, per explicit
// request — so this set alone doesn't fully decide the outcome for UG
// anymore, only combined with that per-stream override.
const STREAMS_WITH_EMPTY_SPECIALIZATION = new Set([
  "Engineering",
  "Law",
  "Dental",
  "Commerce & Business",
  "Design",
  "Others",
  "Arts & Humanities",
]);
const EMPTY_SPECIALIZATION_EXCLUDED_DEGREES = new Set(["BDS", "UG"]);

// Stream+degree combos with a real, flat specialization list (not tied
// to any particular college — unlike CURATED_DEGREE_MAP_BY_STREAM's
// per-college specialization data). Same UX as Medical's Doctorate/
// Others (see MEDICAL_SPECIALIZATIONS below): a SearchableCombobox lets
// the mentor pick from the list or type one that isn't in it. Takes
// priority over STREAMS_WITH_EMPTY_SPECIALIZATION's disabled
// placeholder for whichever degree is listed here — every other degree
// in that stream still falls back to the empty placeholder until it
// gets its own list. B.Tech/B.E and M.Tech/M.E are both deliberately
// absent — both moved to the curated per-college pattern
// (CURATED_DEGREE_MAP_BY_STREAM) once real per-college specialization
// data arrived for each; ENGINEERING_SPECIALIZATIONS and
// PG_ENGINEERING_SPECIALIZATIONS stay defined in lib/options.ts (unused
// here now) in case either is wanted as Engineering's Doctorate/Others
// static fallback later, same as Medical's MEDICAL_SPECIALIZATIONS is
// for its Doctorate/Others.
const FLAT_SPECIALIZATION_LISTS: Record<string, Record<string, readonly string[]>> = {};

// Streams where the Specialization field, once a mentor starts typing,
// widens its search to every specialization known anywhere in that
// stream+degree's dataset (not just the picked college's own list) --
// and where picking one of those "not on this college's own list yet"
// options gets it added to that college's own list on submit (see
// backend EnrollmentsService.mapSpecializationToCollege(), gated by its
// own matching SPECIALIZATION_SUGGESTION_STREAMS constant -- the two
// must be kept in sync by hand, nothing enforces it). Started
// Medical-only (verified live end to end, including that Dental/
// Engineering/Law stayed on the old "college's own list only" behavior
// while this was Medical-scoped); now extended to every stream with a
// curated per-college specialization dataset, per explicit request.
const SPECIALIZATION_SUGGESTION_STREAMS = new Set(["Medical", "Dental", "Engineering", "Law"]);

export function MentorForm({ onExit }: { onExit: () => void }) {
  const wizard = useMultiStep(5);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Curated College/University picker — populated for the Medical-stream
  // degrees in CURATED_DEGREE_MAP (see UniversitiesService.findCurated).
  // `dnbCollegeChoice` is a curated college's id, OTHER_COLLEGE, or ""
  // (nothing picked yet); it's separate from form.collegeName/universityId
  // (the actual submitted values) so "Other" can be distinguished from
  // "not picked yet". Named for its original DNB-only case; now covers
  // every degree in CURATED_DEGREE_MAP.
  const [curatedColleges, setCuratedColleges] = useState<CuratedCollege[]>([]);
  const [loadingCurated, setLoadingCurated] = useState(false);
  const [dnbCollegeChoice, setDnbCollegeChoice] = useState("");
  // Medical keeps the full DEGREES list (UG/PG/MD-MS/DNB/Diploma/
  // Doctorate/DM-MCh/Others); Dental and Engineering each get their own
  // stream-specific first/second degree names; every other stream falls
  // back to the generic UG/PG/Doctorate/Others list.
  const degreeOptions: readonly string[] =
    form.stream === "Medical" ? DEGREES : (DEGREES_BY_STREAM[form.stream] ?? DEFAULT_NON_MEDICAL_DEGREES);
  // Doctorate/Others have no curated per-college dataset of their own in
  // any stream, so hasCuratedData is always false for them -- used below
  // to (a) reuse Medical's static MEDICAL_SPECIALIZATIONS full list for
  // its own Doctorate/Others (unchanged, a hasCuratedData=true special
  // case), and (b) decide whether Engineering/Law/Dental's Doctorate/
  // Others get the stream-wide specialization list (see
  // hasStreamWideSpecialization below).
  const isDoctorateOrOthersDegree = form.degree === "Doctorate" || form.degree === "Others";
  const curatedDegree = CURATED_DEGREE_MAP_BY_STREAM[form.stream]?.[form.degree];
  const hasCuratedData = curatedDegree !== undefined;
  const flatSpecializationOptions = FLAT_SPECIALIZATION_LISTS[form.stream]?.[form.degree];
  const hasFlatSpecializationList = flatSpecializationOptions !== undefined;
  // UG has no specialization concept in every stream that reaches
  // EMPTY_SPECIALIZATION_EXCLUDED_DEGREES (see that constant) — except
  // Arts & Humanities, which per explicit request gets a Specialization
  // field on UG too, unlike every other stream. A one-off carve-out
  // rather than removing "UG" from the shared set entirely, since the
  // set's exclusion is meant to stay the default for every other stream.
  const isExcludedSpecializationDegree =
    EMPTY_SPECIALIZATION_EXCLUDED_DEGREES.has(form.degree) &&
    !(form.stream === "Arts & Humanities" && form.degree === "UG");
  // Doctorate/Others in a stream with real curated college data
  // (Engineering/Law/Dental) get a searchable Specialization field
  // listing every specialization known anywhere across that whole
  // stream's curated datasets (e.g. Engineering: the union of B.Tech +
  // M.Tech + Diploma-Engg's specializations) -- per explicit request,
  // the same "show everything this stream has" idea as Medical's own
  // Doctorate/Others (MEDICAL_SPECIALIZATIONS), just built from the
  // curated data itself rather than a hand-maintained static list (see
  // streamWideSpecializations' fetch effect below). Commerce & Business/
  // Design/Arts & Humanities/Others have no curated data at all
  // (!STREAMS_WITH_COLLEGE_DATA.has(form.stream)), so they're excluded
  // here and keep the plain free-text field via hasFreeTextSpecialization
  // below.
  const hasStreamWideSpecialization = isDoctorateOrOthersDegree && STREAMS_WITH_COLLEGE_DATA.has(form.stream);
  // Mirrors the JSX condition below that renders the plain free-text
  // Specialization field for a STREAMS_WITH_EMPTY_SPECIALIZATION
  // stream+degree with no curated, flat, or stream-wide dataset of its
  // own (today: Commerce & Business/Design/Arts & Humanities/Others'
  // Doctorate/Others/PG/etc, and Arts & Humanities' UG) -- computed once
  // here so validateStep() and the submit payload agree with what's
  // actually rendered, instead of drifting from a copy of the same
  // condition.
  const hasFreeTextSpecialization =
    STREAMS_WITH_EMPTY_SPECIALIZATION.has(form.stream) &&
    !hasCuratedData &&
    !hasFlatSpecializationList &&
    !isExcludedSpecializationDegree &&
    !hasStreamWideSpecialization;
  // See BROWSE_DEGREES — these use the full browse+search picker (see
  // UniversitiesService.findCurated's browse mode) rather than the
  // curated-top-30-+-Other pattern DM-MCh/Diploma still use.
  // CuratedCollegeSearch does its own fetching, so the effect below is
  // skipped for this case; `specializations` comes back on the picked
  // CuratedCollege itself.
  const isBrowseDegree = curatedDegree !== undefined && BROWSE_DEGREES.has(curatedDegree);
  const [browseSpecializations, setBrowseSpecializations] = useState<string[]>([]);
  // Union of every specialization across the whole degree's dataset — the
  // Specialization field's fallback when the mentor types a college that
  // isn't in the list (CuratedCollegeSearch.onPick's `college` is then
  // null, so there's no single college's specializations to scope to;
  // without this fallback the field showed zero options for that case).
  const [allSpecializationsForDegree, setAllSpecializationsForDegree] = useState<string[]>([]);

  useEffect(() => {
    if (!curatedDegree || !isBrowseDegree) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the fallback list when leaving a browse degree
      setAllSpecializationsForDegree([]);
      return;
    }
    let cancelled = false;
    fetchCuratedColleges(form.stream, curatedDegree, { browse: true })
      .then((data) => {
        if (cancelled) return;
        const all = Array.from(new Set(data.flatMap((c) => c.specializations))).sort();
        setAllSpecializationsForDegree(all);
      })
      .catch(() => {
        if (!cancelled) setAllSpecializationsForDegree([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.stream, curatedDegree, isBrowseDegree]);

  // Every specialization known across ALL of this stream's curated
  // degrees combined (not just one degree's own dataset like
  // allSpecializationsForDegree above) -- backs the Specialization field
  // for Doctorate/Others in Engineering/Law/Dental (see
  // hasStreamWideSpecialization). Fetches each of the stream's curated
  // degrees' full browse list in parallel and unions their
  // specializations. CURATED_DEGREE_MAP_BY_STREAM[form.stream]'s values
  // can repeat (Medical's several raw degree keys all map to "MD/MS",
  // for instance) -- deduped via Set before fetching so each curated
  // degree is only ever fetched once per stream.
  const [streamWideSpecializations, setStreamWideSpecializations] = useState<string[]>([]);

  useEffect(() => {
    if (!hasStreamWideSpecialization) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the list when leaving a stream-wide-specialization degree
      setStreamWideSpecializations([]);
      return;
    }
    let cancelled = false;
    const curatedDegreesForStream = Array.from(new Set(Object.values(CURATED_DEGREE_MAP_BY_STREAM[form.stream] ?? {})));
    Promise.all(curatedDegreesForStream.map((degree) => fetchCuratedColleges(form.stream, degree, { browse: true })))
      .then((results) => {
        if (cancelled) return;
        const all = Array.from(new Set(results.flatMap((colleges) => colleges.flatMap((c) => c.specializations)))).sort();
        setStreamWideSpecializations(all);
      })
      .catch(() => {
        if (!cancelled) setStreamWideSpecializations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.stream, hasStreamWideSpecialization]);

  useEffect(() => {
    if (!curatedDegree || isBrowseDegree) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this effect performs
    setLoadingCurated(true);
    fetchCuratedColleges(form.stream, curatedDegree)
      .then((data) => {
        if (!cancelled) setCuratedColleges(data);
      })
      .catch(() => {
        if (!cancelled) setCuratedColleges([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCurated(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.stream, curatedDegree, isBrowseDegree]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function validateStep(): string | null {
    if (wizard.step === 1) {
      if (!form.fullName.trim()) return "Enter your full name.";
      if (!form.alias.trim()) return "Enter an alias / display name.";
      if (form.phone.trim().length !== 10) return "Enter a valid 10-digit phone number.";
      if (!form.gender) return "Select a gender.";
    }
    if (wizard.step === 2) {
      if (!form.state) return "Select your state.";
      if (form.state === "Other" && !form.stateOther.trim()) return "Enter your state.";
      if (!form.city) return "Select your city.";
      if (form.city === "Other" && !form.cityOther.trim()) return "Enter your city.";
    }
    if (wizard.step === 3) {
      if (!form.stream) return "Select your stream.";
      if (form.stream === "Others" && !form.streamOther.trim()) return "Enter your stream.";
      if (!form.degree) return "Select your degree.";
      if (form.degree === "Others" && !form.degreeOther.trim()) return "Enter your degree.";
      if (!form.collegeName.trim()) return "Enter your college.";
      if ((hasCuratedData || hasFlatSpecializationList) && !form.specialization.trim()) {
        return "Enter your specialization.";
      }
    }
    if (wizard.step === 4) {
      if (!form.currentStatus) return "Select your current status.";
      if (form.currentStatus === "Currently Studying" && !form.yearOfStudy) return "Select your year of study.";
      if (form.currentStatus === "Graduated" && !form.graduationYear) return "Select your graduation year.";
      if (form.languages.length === 0) return "Select at least one language.";
      if (form.languages.includes("Others") && !form.languagesOther.trim()) return "Enter your language.";
      if (form.availableDays.length === 0) return "Select at least one preferred timing.";
    }
    if (wizard.step === 5) {
      if (!form.documentFile) return "Upload your college ID / student portal screenshot.";
    }
    return null;
  }

  async function handleNext() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (!wizard.isLast) {
      wizard.next();
      return;
    }

    setSubmitting(true);
    try {
      const documentBase64 = form.documentFile ? await fileToBase64(form.documentFile) : undefined;
      await submitMentorLead({
        fullName: form.fullName.trim(),
        alias: form.alias.trim() || undefined,
        phone: form.phone.trim(),
        gender: form.gender || undefined,
        state: (form.state === "Other" ? form.stateOther.trim() : form.state) || undefined,
        city: (form.city === "Other" ? form.cityOther.trim() : form.city) || undefined,
        collegeName: form.collegeName.trim() || undefined,
        universityId: form.universityId || undefined,
        stream: (form.stream === "Others" ? form.streamOther.trim() : form.stream) || undefined,
        degree: (form.degree === "Others" ? form.degreeOther.trim() : form.degree) || undefined,
        specialization:
          hasCuratedData || hasFlatSpecializationList || hasFreeTextSpecialization || hasStreamWideSpecialization
            ? form.specialization.trim() || undefined
            : undefined,
        currentStatus: form.currentStatus || undefined,
        yearOfStudy:
          form.currentStatus === "Currently Studying" && form.yearOfStudy
            ? YEARS_OF_STUDY.indexOf(form.yearOfStudy as (typeof YEARS_OF_STUDY)[number]) + 1
            : undefined,
        graduationYear:
          form.currentStatus === "Graduated" && form.graduationYear ? parseInt(form.graduationYear, 10) : undefined,
        yearInfoPrivate:
          form.currentStatus === "Currently Studying" || form.currentStatus === "Graduated"
            ? form.yearInfoPrivate
            : undefined,
        languages: form.languages.map((l) => (l === "Others" ? form.languagesOther.trim() : l)).filter(Boolean),
        availableDays: form.availableDays,
        documentType: documentBase64 ? form.documentType : undefined,
        documentBase64,
        website: form.website || undefined,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function exit() {
    setForm(EMPTY);
    setDone(false);
    setError(null);
    wizard.reset();
    onExit();
  }

  if (done) {
    return (
      <div className="max-w-[620px] mx-auto mt-8 bg-surface border border-border rounded-[22px] p-8 text-center shadow-[0_30px_60px_-34px_rgba(16,27,59,.3)] motion-safe:animate-[success-pop_0.5s_ease-out]">
        <div className="w-15 h-15 mx-auto mb-4 rounded-full bg-[#e9f9ee] text-[#1f9d55] flex items-center justify-center text-2xl">
          ✓
        </div>
        <h3 className="text-xl font-extrabold">Welcome aboard!</h3>
        <p className="mt-2 text-[14px] font-semibold text-slate-600">
          We&apos;ll be in touch to help you set up your mentor profile and start guiding students.
        </p>
        <button
          type="button"
          onClick={exit}
          className="mt-4 inline-flex items-center rounded-[9px] border-[1.5px] border-gold-500 text-gold-600 font-bold text-[13.5px] px-3.5 py-2 hover:bg-[#fbf1de] active:scale-[0.96] transition-all"
        >
          Back to top
        </button>
      </div>
    );
  }

  return (
    <form
      className="max-w-[620px] mx-auto mt-8 bg-surface border border-border rounded-[22px] p-7 shadow-[0_30px_60px_-34px_rgba(16,27,59,.3)]"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(e) => set("website", e.target.value)}
        className="absolute -left-[9999px] w-px h-px opacity-0"
        aria-hidden="true"
      />

      <div className="flex items-center justify-between mb-5">
        <button type="button" onClick={exit} className="text-[13px] font-bold text-slate-600 hover:text-ink">
          ← Choose again
        </button>
        <span className="text-[12px] font-extrabold text-slate-400">
          Step {wizard.step} of {wizard.totalSteps}
        </span>
      </div>
      <ProgressBar pct={wizard.progressPct} gold />

      {wizard.step === 1 && (
        <div>
          <h3 className="text-[19px] font-extrabold mb-1">The basics</h3>
          <p className="text-[13.5px] font-semibold text-slate-600 mb-5">
            Your real name stays private — never shown to students.
          </p>
          <Field label="Full name">
            <TextInput
              gold
              required
              placeholder="Enter your full name"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
            />
          </Field>
          <Field label="Alias / Display name" hint="Real name stays private. Aspirant only sees your alias.">
            <TextInput
              gold
              required
              placeholder="e.g. John Snow"
              value={form.alias}
              onChange={(e) => set("alias", e.target.value)}
            />
          </Field>
          <Field label="Phone number">
            <TextInput
              gold
              type="tel"
              inputMode="numeric"
              required
              maxLength={10}
              placeholder="9876543210"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </Field>
          <Field label="Gender">
            <ChipGroup
              gold
              options={GENDERS}
              selected={form.gender ? [form.gender] : []}
              onToggle={(v) => set("gender", toggleInArray(form.gender ? [form.gender] : [], v, false)[0] ?? "")}
            />
          </Field>
        </div>
      )}

      {wizard.step === 2 && (
        <div>
          <h3 className="text-[19px] font-extrabold mb-1">Where you&apos;re based</h3>
          <p className="text-[13.5px] font-semibold text-slate-600 mb-5">&nbsp;</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Field label="State">
              <Select
                gold
                value={form.state}
                onChange={(e) => {
                  // The district list depends entirely on which state this
                  // is, so a city picked under the old state almost never
                  // makes sense under the new one — clear both rather than
                  // silently keep a mismatched pair.
                  set("state", e.target.value);
                  set("city", "");
                  set("cityOther", "");
                }}
              >
                <option value="">Select state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="City">
              <Select
                gold
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                disabled={!form.state}
              >
                <option value="">{form.state ? "Select city" : "Select a state first"}</option>
                {(STATE_DISTRICTS[form.state] ?? []).map((c) => (
                  <option key={c}>{c}</option>
                ))}
                <option value="Other">Other</option>
              </Select>
            </Field>
          </div>
          {form.state === "Other" && (
            <Field label="Your state">
              <TextInput
                gold
                required
                placeholder="Enter your state"
                value={form.stateOther}
                onChange={(e) => set("stateOther", e.target.value)}
              />
            </Field>
          )}
          {form.city === "Other" && (
            <Field label="Your city">
              <TextInput
                gold
                required
                placeholder="Enter your city"
                value={form.cityOther}
                onChange={(e) => set("cityOther", e.target.value)}
              />
            </Field>
          )}
        </div>
      )}

      {wizard.step === 3 && (
        <div>
          <h3 className="text-[19px] font-extrabold mb-1">College details</h3>
          <p className="text-[13.5px] font-semibold text-slate-600 mb-5">&nbsp;</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Field label="Stream">
              <Select
                gold
                value={form.stream}
                onChange={(e) => {
                  set("stream", e.target.value);
                  // The Degree list is stream-specific (see degreeOptions)
                  // — the previously-picked degree may not be a valid
                  // option for the newly-picked stream, so reset it too.
                  set("degree", "");
                  set("specialization", "");
                  set("collegeName", "");
                  set("universityId", "");
                  setDnbCollegeChoice("");
                  setBrowseSpecializations([]);
                }}
              >
                <option value="">Select</option>
                {STREAMS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label="Degree">
              <Select
                gold
                value={form.degree}
                onChange={(e) => {
                  set("degree", e.target.value);
                  set("specialization", "");
                  set("collegeName", "");
                  set("universityId", "");
                  setDnbCollegeChoice("");
                  setBrowseSpecializations([]);
                }}
              >
                <option value="">Select</option>
                {degreeOptions.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
          </div>
          {isBrowseDegree ? (
            <Field label="College / university">
              <CuratedCollegeSearch
                gold
                stream={form.stream}
                degree={curatedDegree!}
                value={form.collegeName}
                onPick={(college, name) => {
                  set("collegeName", name);
                  set("universityId", college?.id ?? "");
                  set("specialization", "");
                  setBrowseSpecializations(college?.specializations ?? []);
                }}
              />
            </Field>
          ) : hasCuratedData ? (
            <>
              <Field label="College / university">
                <Select
                  gold
                  value={dnbCollegeChoice}
                  disabled={loadingCurated}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDnbCollegeChoice(value);
                    set("specialization", "");
                    if (value === OTHER_COLLEGE) {
                      set("collegeName", "");
                      set("universityId", "");
                    } else {
                      const picked = curatedColleges.find((c) => c.id === value);
                      set("collegeName", picked?.label ?? "");
                      set("universityId", value);
                    }
                  }}
                >
                  <option value="">{loadingCurated ? "Loading colleges…" : "Select college"}</option>
                  {curatedColleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                  <option value={OTHER_COLLEGE}>Other (not listed)</option>
                </Select>
              </Field>
              {dnbCollegeChoice === OTHER_COLLEGE && (
                <Field label="Your college / university">
                  <TextInput
                    gold
                    required
                    placeholder="College/university name, state"
                    value={form.collegeName}
                    onChange={(e) => set("collegeName", e.target.value)}
                  />
                </Field>
              )}
            </>
          ) : form.stream === "Medical" ? (
            <Field label="College / university">
              <CollegeSearch
                gold
                value={form.collegeName}
                stream="Medical"
                level={form.degree === "UG" ? "UG" : undefined}
                onPick={(name, id) => {
                  set("collegeName", name);
                  set("universityId", id ?? "");
                }}
              />
            </Field>
          ) : STREAMS_WITH_COLLEGE_DATA.has(form.stream) ? (
            // Covers every degree in Engineering/Dental/Law, including
            // Doctorate/Others -- per explicit request, Doctorate/Others
            // reuse this same stream-wide college search (the same list
            // every other degree in the stream browses/searches) rather
            // than a separate empty field, since a Doctorate student
            // would realistically attend the same universities. (Earlier
            // this session Doctorate/Others were carved out into a
            // separate empty free-text field -- reverted here per
            // explicit follow-up request; COLLEGE_SEARCH_LEVEL_MAP simply
            // has no entry for Doctorate/Others so `level` is undefined
            // for them, same as it already is for any other degree not
            // listed there.)
            <Field label="College / university">
              <CollegeSearch
                gold
                value={form.collegeName}
                stream={form.stream}
                level={COLLEGE_SEARCH_LEVEL_MAP[form.stream]?.[form.degree]}
                onPick={(name, id) => {
                  set("collegeName", name);
                  set("universityId", id ?? "");
                }}
              />
            </Field>
          ) : (
            // No seeded college data exists yet for this stream at all
            // (Commerce & Business, Design, Arts & Humanities, Others --
            // to be added later, per the user) -- plain free-text field,
            // no dropdown/autocomplete list, rather than CollegeSearch
            // (which without a stream filter would surface irrelevant
            // colleges from whichever stream does have data).
            <Field label="College / university">
              <TextInput
                gold
                required
                placeholder="College/university name"
                value={form.collegeName}
                onChange={(e) => set("collegeName", e.target.value)}
              />
            </Field>
          )}
          {form.stream === "Others" && (
            <Field label="Your stream">
              <TextInput
                gold
                required
                placeholder="Enter your stream"
                value={form.streamOther}
                onChange={(e) => set("streamOther", e.target.value)}
              />
            </Field>
          )}
          {form.degree === "Others" && (
            <Field label="Your degree">
              <TextInput
                gold
                required
                placeholder="Enter your degree"
                value={form.degreeOther}
                onChange={(e) => set("degreeOther", e.target.value)}
              />
            </Field>
          )}
          {hasCuratedData && (
            <Field label="Specialization">
              {isBrowseDegree ? (
                <SearchableCombobox
                  gold
                  value={form.specialization}
                  // Others and Doctorate both use the old static
                  // MEDICAL_SPECIALIZATIONS picklist (not tied to the
                  // MD/MS dataset), always in full regardless of which
                  // college is picked, per explicit request. Every other
                  // browse degree (MD/MS, PG, DNB, Diploma, DM/MCh) keeps
                  // showing ONLY the picked college's own list by default
                  // (untouched — same as before) so opening the field with
                  // nothing typed still reads as "this college's real
                  // specializations", not a mixed bag. Only once the
                  // mentor actually starts typing does the option list
                  // widen to include every other specialization known
                  // anywhere in this stream+degree's dataset
                  // (allSpecializationsForDegree) too — the curated
                  // per-college data is necessarily incomplete, so a real
                  // specialization their college just isn't mapped to yet
                  // should still be searchable/pickable once they're
                  // typing, not just accepted as unlisted free text.
                  // Picking one of those "not on this college's own list
                  // yet" options is what backend EnrollmentsService
                  // .mapSpecializationToCollege() maps onto the college's
                  // own Program on submit, so it's pre-populated next
                  // time. SearchableCombobox shows `options` in full when
                  // its own value is empty and filters it once there's
                  // text (see that component) — mirroring that split here
                  // is what keeps the "browse = college only" /
                  // "search = everything" distinction instead of losing
                  // it to a single always-merged list.
                  options={
                    isDoctorateOrOthersDegree
                      ? [...MEDICAL_SPECIALIZATIONS]
                      : SPECIALIZATION_SUGGESTION_STREAMS.has(form.stream) && form.specialization.trim()
                        ? Array.from(new Set([...browseSpecializations, ...allSpecializationsForDegree])).sort()
                        : browseSpecializations.length > 0
                          ? browseSpecializations
                          : allSpecializationsForDegree
                  }
                  disabled={!form.collegeName}
                  placeholder={form.collegeName ? "Select or type to search…" : "Select a college first"}
                  onChange={(v) => set("specialization", v)}
                />
              ) : hasCuratedData ? (
                dnbCollegeChoice && dnbCollegeChoice !== OTHER_COLLEGE ? (
                  <Select gold value={form.specialization} onChange={(e) => set("specialization", e.target.value)}>
                    <option value="">Select</option>
                    {(curatedColleges.find((c) => c.id === dnbCollegeChoice)?.specializations ?? []).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                ) : dnbCollegeChoice === OTHER_COLLEGE ? (
                  <TextInput
                    gold
                    placeholder="e.g. Paediatrics"
                    value={form.specialization}
                    onChange={(e) => set("specialization", e.target.value)}
                  />
                ) : (
                  <Select gold value="" disabled onChange={() => {}}>
                    <option value="">Select a college first</option>
                  </Select>
                )
              ) : (
                <Select gold value={form.specialization} onChange={(e) => set("specialization", e.target.value)}>
                  <option value="">Select</option>
                  {MEDICAL_SPECIALIZATIONS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {hasFlatSpecializationList && (
            <Field label="Specialization">
              <SearchableCombobox
                gold
                value={form.specialization}
                options={[...flatSpecializationOptions!]}
                placeholder="Select or type to search…"
                onChange={(v) => set("specialization", v)}
              />
            </Field>
          )}
          {hasStreamWideSpecialization && (
            // Doctorate/Others in Engineering/Law/Dental -- see
            // hasStreamWideSpecialization and streamWideSpecializations
            // above. A searchable list of every specialization known
            // anywhere across this whole stream's curated data (not
            // scoped to any one college, since the College field here
            // reuses the stream-wide search too, not a specific
            // curated degree's own list), still accepting a typed value
            // that isn't in the list as free text like every other
            // SearchableCombobox here.
            <Field label="Specialization">
              <SearchableCombobox
                gold
                value={form.specialization}
                options={streamWideSpecializations}
                placeholder="Select or type to search…"
                onChange={(v) => set("specialization", v)}
              />
            </Field>
          )}
          {hasFreeTextSpecialization && (
            // No curated, flat, or stream-wide specialization dataset
            // exists for this stream+degree (today: Commerce & Business/
            // Design/Arts & Humanities/Others' Doctorate/Others/PG/etc,
            // and Arts & Humanities' UG -- Engineering/Law/Dental's
            // Doctorate/Others moved to hasStreamWideSpecialization
            // above). Was previously a disabled "Coming soon" select
            // with nothing pickable; per explicit request, replaced with
            // a plain free-text input instead -- same pattern as the
            // curated "Other college" TextInput above -- so the mentor
            // can still record their specialization rather than being
            // blocked or shown a dead end.
            <Field label="Specialization">
              <TextInput
                gold
                placeholder="Enter your specialization"
                value={form.specialization}
                onChange={(e) => set("specialization", e.target.value)}
              />
            </Field>
          )}
        </div>
      )}

      {wizard.step === 4 && (
        <div>
          <h3 className="text-[19px] font-extrabold mb-1">Current status</h3>
          <p className="text-[13.5px] font-semibold text-slate-600 mb-5">&nbsp;</p>
          <Field label="Status">
            <ChipGroup
              gold
              options={CURRENT_STATUSES}
              selected={form.currentStatus ? [form.currentStatus] : []}
              onToggle={(v) =>
                set("currentStatus", toggleInArray(form.currentStatus ? [form.currentStatus] : [], v, false)[0] ?? "")
              }
            />
          </Field>
          {form.currentStatus === "Currently Studying" && (
            <>
              <Field label="Year of study">
                <Select gold value={form.yearOfStudy} onChange={(e) => set("yearOfStudy", e.target.value)}>
                  <option value="">Select</option>
                  {YEARS_OF_STUDY.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </Select>
              </Field>
              <Toggle
                gold
                checked={form.yearInfoPrivate}
                onChange={(v) => set("yearInfoPrivate", v)}
                label="Keep my year of study private"
                hint="When on, this stays anonymous and isn't shown publicly on your profile."
              />
            </>
          )}
          {form.currentStatus === "Graduated" && (
            <>
              <Field label="Year of graduation">
                <Select gold value={form.graduationYear} onChange={(e) => set("graduationYear", e.target.value)}>
                  <option value="">Select</option>
                  {recentYears().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              </Field>
              <Toggle
                gold
                checked={form.yearInfoPrivate}
                onChange={(v) => set("yearInfoPrivate", v)}
                label="Keep my graduation year private"
                hint="When on, this stays anonymous and isn't shown publicly on your profile."
              />
            </>
          )}
          <Field label="Preferred Languages">
            <ChipGroup
              gold
              options={LANGUAGES}
              selected={form.languages}
              onToggle={(v) => set("languages", toggleInArray(form.languages, v))}
            />
          </Field>
          {form.languages.includes("Others") && (
            <Field label="Other language">
              <TextInput
                gold
                required
                placeholder="Enter language"
                value={form.languagesOther}
                onChange={(e) => set("languagesOther", e.target.value)}
              />
            </Field>
          )}
          <Field label="Preferred Timing" hint="(pick any)">
            <ChipGroup
              gold
              options={AVAILABILITY_WINDOWS}
              selected={form.availableDays}
              onToggle={(v) => set("availableDays", toggleInArray(form.availableDays, v))}
            />
          </Field>
        </div>
      )}

      {wizard.step === 5 && (
        <div>
          <h3 className="text-[19px] font-extrabold mb-1">Verify your identity</h3>
          <p className="text-[13.5px] font-semibold text-slate-600 mb-5">Get verified and start earning</p>
          <Field label="Document type">
            <Select
              gold
              value={form.documentType}
              onChange={(e) => set("documentType", e.target.value)}
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <label className="block border-[1.5px] border-dashed border-border rounded-2xl p-6 text-center text-slate-600 text-[13px] font-bold cursor-pointer hover:border-gold-500 transition-colors">
            <div className="text-2xl mb-1.5">📎</div>
            {form.documentFile ? form.documentFile.name : "Upload college ID / student portal screenshot"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => set("documentFile", e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      )}

      <ErrorText message={error} />

      <div className="flex gap-2.5 mt-6">
        <button
          type="button"
          onClick={wizard.back}
          className={`flex-1 rounded-[11px] border-[1.5px] border-gold-500 text-gold-600 font-bold text-[14.5px] py-3 hover:bg-[#fbf1de] active:scale-[0.97] transition-all ${
            wizard.isFirst ? "invisible" : ""
          }`}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="flex-1 rounded-[11px] bg-gold-500 text-white font-bold text-[14.5px] py-3 disabled:opacity-60 shadow-[0_8px_20px_-8px_rgba(201,150,47,.55)] hover:bg-gold-400 active:scale-[0.97] transition-all disabled:active:scale-100"
        >
          {submitting ? "Submitting…" : wizard.isLast ? "Submit application" : "Continue"}
        </button>
      </div>
    </form>
  );
}
