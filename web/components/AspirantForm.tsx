"use client";

import { useEffect, useState } from "react";
import { submitAspirantLead, fetchCuratedColleges, ApiError } from "../lib/api";
import {
  GENDERS,
  INDIAN_STATES,
  STATE_DISTRICTS,
  STREAMS,
  DEGREES,
  DEGREES_BY_STREAM,
  DEFAULT_NON_MEDICAL_DEGREES,
  MEDICAL_SPECIALIZATIONS,
  MENTORSHIP_TIMINGS,
  LANGUAGES,
} from "../lib/options";
import { useMultiStep } from "../lib/useMultiStep";
import { Field, TextInput, Select, ChipGroup, toggleInArray, ProgressBar, ErrorText } from "./form-bits";
import { CollegeSearch } from "./CollegeSearch";
import { CuratedCollegeSearch } from "./CuratedCollegeSearch";
import { SearchableCombobox } from "./SearchableCombobox";
import { CURATED_DEGREE_MAP_BY_STREAM, STREAMS_WITH_COLLEGE_DATA, COLLEGE_SEARCH_LEVEL_MAP } from "./MentorForm";

type FormState = {
  fullName: string;
  alias: string;
  phone: string;
  gender: string;
  state: string;
  stateOther: string;
  city: string;
  cityOther: string;
  qualification: string;
  qualificationOther: string;
  stream: string;
  streamOther: string;
  collegeName: string;
  universityId: string;
  specialization: string;
  courseInterested: string;
  preferredLanguages: string[];
  preferredLanguagesOther: string;
  preferredMentorshipTimings: string[];
  website: string; // honeypot — never rendered visibly, see MentorForm for the full note
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
  qualification: "",
  qualificationOther: "",
  stream: "",
  streamOther: "",
  collegeName: "",
  universityId: "",
  specialization: "",
  courseInterested: "",
  preferredLanguages: [],
  preferredLanguagesOther: "",
  preferredMentorshipTimings: [],
  website: "",
};

export function AspirantForm({ onExit }: { onExit: () => void }) {
  const wizard = useMultiStep(4);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Current qualification's options now depend on Field of interest, the
  // same way MentorForm.tsx's Degree options depend on Stream (same three
  // source constants, same Medical-gets-the-full-list / Dental+Engineering-
  // get-their-own-subset / everything-else-gets-the-default-UG-PG-Doctorate-
  // Others fallback shape) -- per explicit request, "Field of interest" is
  // this form's Stream and "Current qualification" is this form's Degree.
  // The one difference: "Higher Secondary (12th)" is always prepended
  // regardless of stream, since a 12th-grade aspirant hasn't committed to
  // any stream-specific degree track yet -- that option needs to exist no
  // matter what Field of interest is picked, unlike every other
  // qualification which is genuinely stream-specific. For Medical this
  // reproduces the same list the old flat QUALIFICATIONS constant had
  // (Higher Secondary + all of DEGREES), aside from DEGREES' own "UG" ->
  // "MBBS" rename (see that constant) -- Dental/Engineering now get their
  // own narrower, correct subset, and every other stream gets
  // DEFAULT_NON_MEDICAL_DEGREES instead of the full Medical-shaped list,
  // which never made sense for a Law or Design aspirant to begin with.
  const qualificationOptions: readonly string[] = [
    "Higher Secondary (12th)",
    ...(form.stream === "Medical" ? DEGREES : (DEGREES_BY_STREAM[form.stream] ?? DEFAULT_NON_MEDICAL_DEGREES)),
  ];

  // College and Specialization show for any qualification except Higher
  // Secondary (12th) -- a 12th-grade aspirant hasn't started a degree yet,
  // so there's nothing to ask. Per explicit request, reuses the exact same
  // curated-per-stream mechanism as MentorForm.tsx's own College field
  // (same CURATED_DEGREE_MAP_BY_STREAM / STREAMS_WITH_COLLEGE_DATA /
  // COLLEGE_SEARCH_LEVEL_MAP, imported from there rather than duplicated,
  // since "Current qualification" carries the same literal degree strings
  // as MentorForm's "Degree" — see qualificationOptions above).
  const showCollege = !!form.qualification && form.qualification !== "Higher Secondary (12th)";
  // Specialization is hidden for MBBS specifically (Medical's UG-
  // equivalent) per explicit request, matching MentorForm.tsx's own
  // longstanding rule that MBBS/UG has no specialization concept --
  // College still shows for MBBS (a mentor's own MBBS college is a real,
  // curated-searchable answer), just not Specialization. "MBBS" is
  // unique to Medical (see DEGREES), so no stream check is needed here.
  const showSpecialization = showCollege && form.qualification !== "MBBS";
  const curatedDegree = CURATED_DEGREE_MAP_BY_STREAM[form.stream]?.[form.qualification];
  const hasCuratedData = curatedDegree !== undefined;
  const isDoctorateOrOthersQualification = form.qualification === "Doctorate" || form.qualification === "Others";
  // One deliberate difference from MentorForm.tsx: Specialization here is
  // never scoped to the picked college — per explicit request, it always
  // shows every specialization known for the whole picked degree (not
  // "that college's own list, widened only once typing" like the mentor
  // form). For a specific curated degree (MD/MS, MDS, B.Tech, Law-UG,
  // etc.) that's the union across every college offering it
  // (allSpecializationsForDegree below); for Doctorate/Others in a stream
  // with real curated data (Engineering/Law/Dental) it's the union across
  // every curated degree in that whole stream (streamWideSpecializations
  // below, same mechanism as MentorForm's own hasStreamWideSpecialization
  // for the same case).
  const hasStreamWideSpecialization = isDoctorateOrOthersQualification && STREAMS_WITH_COLLEGE_DATA.has(form.stream);
  // Same real-bug fix as MentorForm.tsx's own shouldFetchMedicalStreamWideSpecialization:
  // Medical's Doctorate/Others used to show only the static
  // MEDICAL_SPECIALIZATIONS list, which despite its name only ever
  // reflected MD/MS-shaped specialties -- not DNB/Diploma/DM-MCh. This
  // triggers the same streamWideSpecializations fetch (below) for
  // Medical too, so the field can merge in the real, data-driven union
  // across every one of Medical's curated degrees.
  const shouldFetchMedicalStreamWideSpecialization = isDoctorateOrOthersQualification && form.stream === "Medical";

  const [allSpecializationsForDegree, setAllSpecializationsForDegree] = useState<string[]>([]);
  useEffect(() => {
    if (!hasCuratedData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the list when leaving a curated degree
      setAllSpecializationsForDegree([]);
      return;
    }
    let cancelled = false;
    fetchCuratedColleges(form.stream, curatedDegree!, { browse: true })
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
  }, [form.stream, curatedDegree, hasCuratedData]);

  const [streamWideSpecializations, setStreamWideSpecializations] = useState<string[]>([]);
  useEffect(() => {
    if (!hasStreamWideSpecialization && !shouldFetchMedicalStreamWideSpecialization) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the list when leaving a stream-wide-specialization qualification
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
  }, [form.stream, hasStreamWideSpecialization, shouldFetchMedicalStreamWideSpecialization]);

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
      if (!form.stream) return "Select your field of interest.";
      if (form.stream === "Others" && !form.streamOther.trim()) return "Enter your field of interest.";
      if (!form.qualification) return "Select your current qualification.";
      if (form.qualification === "Others" && !form.qualificationOther.trim()) return "Enter your qualification.";
      if (showCollege && !form.collegeName.trim()) return "Enter your college.";
      // Mirrors MentorForm.tsx's own validateStep: specialization is
      // required exactly when it's a specific curated degree's own list
      // (hasCuratedData) -- the stream-wide and plain-free-text cases stay
      // optional there too. showSpecialization guards against MBBS, whose
      // hasCuratedData is already false anyway (no curated data exists
      // for it), but included for clarity/safety.
      if (showSpecialization && hasCuratedData && !form.specialization.trim()) return "Enter your specialization.";
    }
    if (wizard.step === 4) {
      if (form.preferredLanguages.length === 0) return "Select at least one preferred language.";
      if (form.preferredLanguages.includes("Others") && !form.preferredLanguagesOther.trim()) {
        return "Enter your language.";
      }
      if (form.preferredMentorshipTimings.length === 0) return "Select at least one preferred timing.";
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
      await submitAspirantLead({
        fullName: form.fullName.trim(),
        alias: form.alias.trim() || undefined,
        phone: form.phone.trim(),
        gender: form.gender || undefined,
        state: (form.state === "Other" ? form.stateOther.trim() : form.state) || undefined,
        city: (form.city === "Other" ? form.cityOther.trim() : form.city) || undefined,
        qualification:
          (form.qualification === "Others" ? form.qualificationOther.trim() : form.qualification) || undefined,
        stream: (form.stream === "Others" ? form.streamOther.trim() : form.stream) || undefined,
        universityId: showCollege ? form.universityId || undefined : undefined,
        collegeName: showCollege ? form.collegeName.trim() || undefined : undefined,
        specialization: showSpecialization ? form.specialization.trim() || undefined : undefined,
        courseInterested: form.courseInterested.trim() || undefined,
        // Backend columns are single free-text strings (see CreateAspirantLeadDto)
        // — multiple picks join into one readable value rather than needing a
        // schema change for what are optional, low-stakes preference fields.
        preferredLanguage: form.preferredLanguages.length
          ? form.preferredLanguages
              .map((l) => (l === "Others" ? form.preferredLanguagesOther.trim() : l))
              .filter(Boolean)
              .join(", ")
          : undefined,
        preferredMentorshipTiming: form.preferredMentorshipTimings.length
          ? form.preferredMentorshipTimings.join(", ")
          : undefined,
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
        <h3 className="text-xl font-extrabold">You&apos;re on the list!</h3>
        <p className="mt-2 text-[14px] font-semibold text-slate-600">
          We&apos;ll text you the moment a mentor who fits is ready to chat.
        </p>
        <button
          type="button"
          onClick={exit}
          className="mt-4 inline-flex items-center rounded-[9px] border-[1.5px] border-blue-600 text-blue-600 font-bold text-[13.5px] px-3.5 py-2 hover:bg-[#eef3ff] active:scale-[0.96] transition-all"
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
      {/* Honeypot — real people never see or fill this; anything non-empty
          here is a bot, and the backend silently discards it. */}
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
      <ProgressBar pct={wizard.progressPct} />

      {wizard.step === 1 && (
        <div>
          <h3 className="text-[19px] font-extrabold mb-1">The basics</h3>
          <p className="text-[13.5px] font-semibold text-slate-600 mb-5">Core identity details</p>
          <Field label="Full name">
            <TextInput
              required
              placeholder="Enter your full name"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
            />
          </Field>
          <Field label="Alias / Display name" hint="Real name stays private. Mentors only see your alias.">
            <TextInput
              required
              placeholder="e.g. John Snow"
              value={form.alias}
              onChange={(e) => set("alias", e.target.value)}
            />
          </Field>
          <Field label="Phone number">
            <TextInput
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
          <p className="text-[13.5px] font-semibold text-slate-600 mb-5">
            Helps us surface mentors and colleges near you.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Field label="State">
              <Select
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
              <Select value={form.city} onChange={(e) => set("city", e.target.value)} disabled={!form.state}>
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
          <h3 className="text-[19px] font-extrabold mb-1">Academics</h3>
          <p className="text-[13.5px] font-semibold text-slate-600 mb-5">
            What stage are you at, and what are you aiming for?
          </p>
          <Field label="Field of interest">
            <Select
              value={form.stream}
              onChange={(e) => {
                set("stream", e.target.value);
                // Current qualification's options are stream-specific (see
                // qualificationOptions), and College/Specialization's data
                // is stream-specific too (see CURATED_DEGREE_MAP_BY_STREAM)
                // — the previously-picked values may not be valid for the
                // newly-picked stream, so reset them all (same reasoning
                // MentorForm.tsx uses when Stream changes there).
                set("qualification", "");
                set("collegeName", "");
                set("universityId", "");
                set("specialization", "");
              }}
            >
              <option value="">Select</option>
              {STREAMS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Current qualification">
            <Select
              value={form.qualification}
              onChange={(e) => {
                set("qualification", e.target.value);
                // College's curated dataset is qualification-specific too
                // (see CURATED_DEGREE_MAP_BY_STREAM) — same reset reasoning
                // as MentorForm.tsx's own Degree change handler.
                set("collegeName", "");
                set("universityId", "");
                set("specialization", "");
              }}
            >
              <option value="">Select</option>
              {qualificationOptions.map((q) => (
                <option key={q}>{q}</option>
              ))}
            </Select>
          </Field>
          {form.stream === "Others" && (
            <Field label="Your field of interest">
              <TextInput
                required
                placeholder="Enter your field of interest"
                value={form.streamOther}
                onChange={(e) => set("streamOther", e.target.value)}
              />
            </Field>
          )}
          {form.qualification === "Others" && (
            <Field label="Your qualification">
              <TextInput
                required
                placeholder="Enter your qualification"
                value={form.qualificationOther}
                onChange={(e) => set("qualificationOther", e.target.value)}
              />
            </Field>
          )}
          {showCollege && (
            <Field label="College / university">
              {hasCuratedData ? (
                <CuratedCollegeSearch
                  stream={form.stream}
                  degree={curatedDegree!}
                  value={form.collegeName}
                  onPick={(college, name) => {
                    set("collegeName", name);
                    set("universityId", college?.id ?? "");
                  }}
                />
              ) : form.stream === "Medical" ? (
                <CollegeSearch
                  value={form.collegeName}
                  stream="Medical"
                  // form.qualification is "MBBS" (the renamed display
                  // value), but the actual data-level tag on
                  // University.levels is still "UG" -- a separate,
                  // unrelated concept (same note as MentorForm.tsx's own
                  // copy of this).
                  level={form.qualification === "MBBS" ? "UG" : undefined}
                  onPick={(name, id) => {
                    set("collegeName", name);
                    set("universityId", id ?? "");
                  }}
                />
              ) : STREAMS_WITH_COLLEGE_DATA.has(form.stream) ? (
                <CollegeSearch
                  value={form.collegeName}
                  stream={form.stream}
                  level={COLLEGE_SEARCH_LEVEL_MAP[form.stream]?.[form.qualification]}
                  onPick={(name, id) => {
                    set("collegeName", name);
                    set("universityId", id ?? "");
                  }}
                />
              ) : (
                // No seeded college data exists yet for this stream at all
                // (Commerce & Business, Design, Arts & Humanities, Others).
                <TextInput
                  required
                  placeholder="College/university name"
                  value={form.collegeName}
                  onChange={(e) => set("collegeName", e.target.value)}
                />
              )}
            </Field>
          )}
          {showSpecialization && (
            <Field label="Specialization">
              {isDoctorateOrOthersQualification && form.stream === "Medical" ? (
                // Union of the hand-curated MEDICAL_SPECIALIZATIONS list
                // with the real, data-driven union across every one of
                // Medical's curated degrees (MD/MS, DNB, Diploma, DM/MCh
                // -- see shouldFetchMedicalStreamWideSpecialization
                // above). Fixes a real bug: MEDICAL_SPECIALIZATIONS alone
                // only ever reflected MD/MS-shaped specialties, so
                // Doctorate/Others effectively showed just "the MD list"
                // instead of every medical degree's specializations.
                // Merging (not replacing) means the field never regresses
                // to fewer options while the fetch is still in flight.
                <SearchableCombobox
                  value={form.specialization}
                  options={Array.from(new Set([...MEDICAL_SPECIALIZATIONS, ...streamWideSpecializations])).sort()}
                  placeholder="Select or type to search…"
                  onChange={(v) => set("specialization", v)}
                />
              ) : hasCuratedData ? (
                <SearchableCombobox
                  value={form.specialization}
                  options={allSpecializationsForDegree}
                  placeholder="Select or type to search…"
                  onChange={(v) => set("specialization", v)}
                />
              ) : hasStreamWideSpecialization ? (
                <SearchableCombobox
                  value={form.specialization}
                  options={streamWideSpecializations}
                  placeholder="Select or type to search…"
                  onChange={(v) => set("specialization", v)}
                />
              ) : (
                <TextInput
                  placeholder="e.g. Cardiology"
                  value={form.specialization}
                  onChange={(e) => set("specialization", e.target.value)}
                />
              )}
            </Field>
          )}
          <Field label="Course you're aiming for" hint="(optional)">
            <TextInput
              placeholder="e.g. MBBS, B.Tech, BL"
              value={form.courseInterested}
              onChange={(e) => set("courseInterested", e.target.value)}
            />
          </Field>
        </div>
      )}

      {wizard.step === 4 && (
        <div>
          <h3 className="text-[19px] font-extrabold mb-1">Preferences</h3>
          <p className="text-[13.5px] font-semibold text-slate-600 mb-5">
            Last step — this helps us find the right mentors for you.
          </p>
          <Field label="Preferred language" hint="(pick any)">
            <ChipGroup
              options={LANGUAGES}
              selected={form.preferredLanguages}
              onToggle={(v) => set("preferredLanguages", toggleInArray(form.preferredLanguages, v))}
            />
          </Field>
          {form.preferredLanguages.includes("Others") && (
            <Field label="Other language">
              <TextInput
                required
                placeholder="Enter language"
                value={form.preferredLanguagesOther}
                onChange={(e) => set("preferredLanguagesOther", e.target.value)}
              />
            </Field>
          )}
          <Field label="Preferred Timing" hint="(pick any)">
            <ChipGroup
              options={MENTORSHIP_TIMINGS}
              selected={form.preferredMentorshipTimings}
              onToggle={(v) => set("preferredMentorshipTimings", toggleInArray(form.preferredMentorshipTimings, v))}
            />
          </Field>
        </div>
      )}

      <ErrorText message={error} />

      <div className="flex gap-2.5 mt-6">
        <button
          type="button"
          onClick={wizard.back}
          className={`flex-1 rounded-[11px] border-[1.5px] border-blue-600 text-blue-600 font-bold text-[14.5px] py-3 hover:bg-[#eef3ff] active:scale-[0.97] transition-all ${
            wizard.isFirst ? "invisible" : ""
          }`}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="flex-1 rounded-[11px] bg-blue-600 text-white font-bold text-[14.5px] py-3 disabled:opacity-60 shadow-[0_8px_20px_-8px_rgba(33,72,201,.55)] hover:bg-blue-500 active:scale-[0.97] transition-all disabled:active:scale-100"
        >
          {submitting ? "Submitting…" : wizard.isLast ? "Submit" : "Continue"}
        </button>
      </div>
    </form>
  );
}
