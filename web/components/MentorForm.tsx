"use client";

import { useEffect, useRef, useState } from "react";
import { submitMentorLead, searchUniversities, fileToBase64, ApiError, University } from "../lib/api";
import {
  GENDERS,
  INDIAN_STATES,
  STATE_DISTRICTS,
  STREAMS,
  DEGREES,
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

function CollegeSearch({
  value,
  onPick,
}: {
  value: string;
  onPick: (name: string, id: string | null) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<University[]>([]);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  // Debounced live search against the public GET /universities — same
  // endpoint the mobile mentor wizard's college picker uses. A college not
  // in this list is still accepted: onPick(query, null) below keeps the raw
  // text so the lead never loses the answer, matching CreateMentorLeadDto.
  //
  // Deliberately does NOT compare `query` against the `value` prop to decide
  // whether to search: onPick fires on every keystroke to keep the parent's
  // collegeName in sync as free text, which lands `value` back at `query` on
  // the very next render — a naive "skip if unchanged" guard would fire after
  // every single keystroke and wipe the results that keystroke just fetched.
  useEffect(() => {
    // Below the 2-char threshold, just skip scheduling a search — the render
    // guard below (`query.trim().length >= 2`) hides any stale `results`
    // rather than this effect clearing them, since a synchronous setState
    // right in the effect body (not inside the async .then()/.catch() below)
    // is exactly the pattern React's set-state-in-effect rule flags.
    if (query.trim().length < 2) return;
    const thisRequest = ++requestId.current;
    const handle = setTimeout(() => {
      searchUniversities(query)
        .then((res) => {
          // Ignore if a newer keystroke has already started a later request
          // — otherwise a slow response for "A" can land after a fast one
          // for "A J" and stomp the more specific results back to noise.
          if (thisRequest === requestId.current) setResults(res.data);
        })
        .catch(() => {
          if (thisRequest === requestId.current) setResults([]);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="relative">
      <TextInput
        gold
        required
        placeholder="Start typing to search…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onPick(e.target.value, null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && query.trim().length >= 2 && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-border rounded-[11px] shadow-lg max-h-56 overflow-auto">
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => {
                  setQuery(u.name);
                  onPick(u.name, u.id);
                  setOpen(false);
                }}
                className="w-full text-left px-3.5 py-2.5 text-[13.5px] font-semibold hover:bg-[#fbf1de]"
              >
                {u.name}
                <span className="block text-[11.5px] font-medium text-slate-400">
                  {u.city ? `${u.city}, ` : ""}
                  {u.state}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MentorForm({ onExit }: { onExit: () => void }) {
  const wizard = useMultiStep(5);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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
      if (!form.collegeName.trim()) return "Enter your college.";
      if (form.stream === "Others" && !form.streamOther.trim()) return "Enter your stream.";
      if (form.degree === "Others" && !form.degreeOther.trim()) return "Enter your degree.";
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
          form.stream === "Medical" && form.degree && form.degree !== "UG"
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
            <Field label="City" hint="(required)">
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
                  set("specialization", "");
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
                }}
              >
                <option value="">Select</option>
                {DEGREES.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="College / university">
            <CollegeSearch
              value={form.collegeName}
              onPick={(name, id) => {
                set("collegeName", name);
                set("universityId", id ?? "");
              }}
            />
          </Field>
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
          {form.stream === "Medical" && form.degree && form.degree !== "UG" && (
            <Field label="Specialization" hint="(optional)">
              <TextInput
                gold
                placeholder="e.g. Paediatrics"
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
          <Field label="Preferred Timing" hint="(optional, pick any)">
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
