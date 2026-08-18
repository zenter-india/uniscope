"use client";

import { useState } from "react";
import { submitAspirantLead, ApiError } from "../lib/api";
import {
  GENDERS,
  INDIAN_STATES,
  STATE_DISTRICTS,
  QUALIFICATIONS,
  STREAMS,
  MENTORSHIP_TIMINGS,
  LANGUAGES,
} from "../lib/options";
import { useMultiStep } from "../lib/useMultiStep";
import { Field, TextInput, Select, ChipGroup, toggleInArray, ProgressBar, ErrorText } from "./form-bits";

type FormState = {
  fullName: string;
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
  specialization: string;
  courseInterested: string;
  preferredLanguages: string[];
  preferredMentorshipTimings: string[];
  website: string; // honeypot — never rendered visibly, see MentorForm for the full note
};

const EMPTY: FormState = {
  fullName: "",
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
  specialization: "",
  courseInterested: "",
  preferredLanguages: [],
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

  function validateStep(): string | null {
    if (wizard.step === 1) {
      if (!form.fullName.trim()) return "Enter your full name.";
      if (form.phone.trim().length !== 10) return "Enter a valid 10-digit phone number.";
      if (!form.gender) return "Select a gender.";
    }
    if (wizard.step === 2) {
      if (!form.state) return "Select your state.";
      if (form.state === "Other" && !form.stateOther.trim()) return "Enter your state.";
      if (!form.city) return "Select your city.";
      if (form.city === "Other" && !form.cityOther.trim()) return "Enter your city.";
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
        phone: form.phone.trim(),
        gender: form.gender || undefined,
        state: (form.state === "Other" ? form.stateOther.trim() : form.state) || undefined,
        city: (form.city === "Other" ? form.cityOther.trim() : form.city) || undefined,
        qualification:
          (form.qualification === "Others" ? form.qualificationOther.trim() : form.qualification) || undefined,
        stream: (form.stream === "Others" ? form.streamOther.trim() : form.stream) || undefined,
        specialization:
          form.stream === "Medical" &&
          form.qualification &&
          form.qualification !== "Higher Secondary (12th)" &&
          form.qualification !== "Undergraduate"
            ? form.specialization.trim() || undefined
            : undefined,
        courseInterested: form.courseInterested.trim() || undefined,
        // Backend columns are single free-text strings (see CreateAspirantLeadDto)
        // — multiple picks join into one readable value rather than needing a
        // schema change for what are optional, low-stakes preference fields.
        preferredLanguage: form.preferredLanguages.length ? form.preferredLanguages.join(", ") : undefined,
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
            <Field label="City" hint="(required)">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <Field label="Current qualification">
              <Select value={form.qualification} onChange={(e) => set("qualification", e.target.value)}>
                <option value="">Select</option>
                {QUALIFICATIONS.map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </Select>
            </Field>
            <Field label="Field of interest">
              <Select value={form.stream} onChange={(e) => set("stream", e.target.value)}>
                <option value="">Select</option>
                {STREAMS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
          </div>
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
          {form.stream === "Medical" &&
            form.qualification &&
            form.qualification !== "Higher Secondary (12th)" &&
            form.qualification !== "Undergraduate" && (
              <Field label="Specialization" hint="(optional)">
                <TextInput
                  placeholder="e.g. Cardiology"
                  value={form.specialization}
                  onChange={(e) => set("specialization", e.target.value)}
                />
              </Field>
            )}
          <Field label="Course you're aiming for" hint="(optional)">
            <TextInput
              placeholder="e.g. MBBS"
              list="course-interested-options"
              value={form.courseInterested}
              onChange={(e) => set("courseInterested", e.target.value)}
            />
            <datalist id="course-interested-options">
              <option value="MBBS" />
              <option value="B.Tech" />
              <option value="BL" />
            </datalist>
          </Field>
        </div>
      )}

      {wizard.step === 4 && (
        <div>
          <h3 className="text-[19px] font-extrabold mb-1">Preferences</h3>
          <p className="text-[13.5px] font-semibold text-slate-600 mb-5">
            Last step — this helps us find the right mentors for you.
          </p>
          <Field label="Preferred language" hint="(optional, pick any)">
            <ChipGroup
              options={LANGUAGES.slice(0, 6)}
              selected={form.preferredLanguages}
              onToggle={(v) => set("preferredLanguages", toggleInArray(form.preferredLanguages, v))}
            />
          </Field>
          <Field label="Preferred Timing" hint="(optional, pick any)">
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
