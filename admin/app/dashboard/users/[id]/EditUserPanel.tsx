'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateUserProfile } from './actions';

export interface EditableUser {
  id: string;
  displayName: string;
  role: 'ASPIRANT' | 'MENTOR' | 'ADMIN';
  verificationStatus: string;
  realName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  state: string | null;
  city: string | null;
  qualification: string | null;
  stream: string | null;
  specialization: string | null;
  courseInterested: string | null;
  yearOfStudy: number | null;
  graduationYear: number | null;
  yearInfoPrivate: boolean;
  bio: string | null;
  specialty: string | null;
  languages: string[];
  availableDays: string[];
  goals: string[];
  preferredLanguage: string | null;
  preferredMentorshipTiming: string | null;
  isMentorAvailable: boolean;
  freeChatsRemaining: number;
  freeCallSecondsRemaining: number;
}

const VERIFICATION_OPTIONS = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
];

type FormState = Record<string, string | boolean>;

function toForm(u: EditableUser): FormState {
  return {
    displayName: u.displayName,
    role: u.role,
    verificationStatus: u.verificationStatus,
    realName: u.realName ?? '',
    dateOfBirth: u.dateOfBirth ?? '',
    gender: u.gender ?? '',
    state: u.state ?? '',
    city: u.city ?? '',
    qualification: u.qualification ?? '',
    stream: u.stream ?? '',
    specialization: u.specialization ?? '',
    courseInterested: u.courseInterested ?? '',
    yearOfStudy: u.yearOfStudy != null ? String(u.yearOfStudy) : '',
    graduationYear: u.graduationYear != null ? String(u.graduationYear) : '',
    yearInfoPrivate: u.yearInfoPrivate,
    bio: u.bio ?? '',
    specialty: u.specialty ?? '',
    languages: u.languages.join(', '),
    availableDays: u.availableDays.join(', '),
    goals: u.goals.join(', '),
    preferredLanguage: u.preferredLanguage ?? '',
    preferredMentorshipTiming: u.preferredMentorshipTiming ?? '',
    isMentorAvailable: u.isMentorAvailable,
    freeChatsRemaining: String(u.freeChatsRemaining),
    freeCallSecondsRemaining: String(u.freeCallSecondsRemaining),
  };
}

const ARRAY_FIELDS = new Set(['languages', 'availableDays', 'goals']);
const INT_FIELDS = new Set([
  'yearOfStudy',
  'graduationYear',
  'freeChatsRemaining',
  'freeCallSecondsRemaining',
]);

/** Build the patch: only fields whose form value differs from the original. */
function diff(current: FormState, original: FormState): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(current)) {
    if (current[key] === original[key]) continue;
    const v = current[key];
    if (typeof v === 'boolean') {
      patch[key] = v;
    } else if (ARRAY_FIELDS.has(key)) {
      patch[key] = v.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (INT_FIELDS.has(key)) {
      if (v === '') continue; // don't send a cleared number field
      patch[key] = Number(v);
    } else {
      patch[key] = v;
    }
  }
  return patch;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500';

export function EditUserPanel({ user }: { user: EditableUser }) {
  const router = useRouter();
  const original = toForm(user);
  const [form, setForm] = useState<FormState>(original);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const set = (k: string, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const T = (k: keyof FormState, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      className={inputCls}
      value={form[k] as string}
      onChange={(e) => set(k as string, e.target.value)}
      {...props}
    />
  );

  const save = () => {
    setError(null);
    setSaved(false);
    const patch = diff(form, original);
    if (Object.keys(patch).length === 0) {
      setError('Nothing changed.');
      return;
    }
    startTransition(async () => {
      const res = await updateUserProfile(user.id, patch);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      setOpen(false);
      router.refresh();
    });
  };

  if (user.role === 'ADMIN') return null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">Edit profile</h2>
        <button
          onClick={() => {
            setOpen((v) => !v);
            setError(null);
            setSaved(false);
            if (open) setForm(original);
          }}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {open ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {saved && !open && (
        <p className="mt-2 text-sm text-emerald-600">Saved.</p>
      )}

      {open && (
        <div className="mt-4 flex flex-col gap-5">
          <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <legend className="col-span-full mb-1 text-xs font-semibold text-zinc-500">
              Account
            </legend>
            <Row label="Display name / alias">{T('displayName')}</Row>
            <Row label="Role">
              <select
                className={inputCls}
                value={form.role as string}
                onChange={(e) => set('role', e.target.value)}
              >
                <option value="ASPIRANT">ASPIRANT</option>
                <option value="MENTOR">MENTOR</option>
              </select>
            </Row>
            <Row label="Verification status">
              <select
                className={inputCls}
                value={form.verificationStatus as string}
                onChange={(e) => set('verificationStatus', e.target.value)}
              >
                {VERIFICATION_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Row>
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <legend className="col-span-full mb-1 text-xs font-semibold text-zinc-500">
              Identity & location
            </legend>
            <Row label="Real name">{T('realName')}</Row>
            <Row label="Date of birth">{T('dateOfBirth', { type: 'date' })}</Row>
            <Row label="Gender">{T('gender')}</Row>
            <Row label="State">{T('state')}</Row>
            <Row label="City">{T('city')}</Row>
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <legend className="col-span-full mb-1 text-xs font-semibold text-zinc-500">
              Academic
            </legend>
            <Row label="Qualification / degree">{T('qualification')}</Row>
            <Row label="Stream / field">{T('stream')}</Row>
            <Row label="Specialization">{T('specialization')}</Row>
            <Row label="Course interested">{T('courseInterested')}</Row>
            <Row label="Year of study">{T('yearOfStudy', { type: 'number', min: 1, max: 10 })}</Row>
            <Row label="Graduation year">
              {T('graduationYear', { type: 'number', min: 1950, max: 2100 })}
            </Row>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.yearInfoPrivate as boolean}
                onChange={(e) => set('yearInfoPrivate', e.target.checked)}
              />
              Year info private
            </label>
            <Row label="Goals (comma-separated)">{T('goals')}</Row>
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <legend className="col-span-full mb-1 text-xs font-semibold text-zinc-500">
              Preferences & mentor profile
            </legend>
            <Row label="Preferred language">{T('preferredLanguage')}</Row>
            <Row label="Preferred mentorship timing">{T('preferredMentorshipTiming')}</Row>
            <Row label="Specialty">{T('specialty')}</Row>
            <Row label="Languages (comma-separated)">{T('languages')}</Row>
            <Row label="Available days (comma-separated)">{T('availableDays')}</Row>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={form.isMentorAvailable as boolean}
                onChange={(e) => set('isMentorAvailable', e.target.checked)}
              />
              Accepting call bookings
            </label>
            <Row label="Bio">
              <textarea
                className={inputCls}
                rows={2}
                value={form.bio as string}
                onChange={(e) => set('bio', e.target.value)}
              />
            </Row>
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <legend className="col-span-full mb-1 text-xs font-semibold text-zinc-500">
              Free tier
            </legend>
            <Row label="Free chats remaining">
              {T('freeChatsRemaining', { type: 'number', min: 0, max: 100 })}
            </Row>
            <Row label="Free call seconds remaining">
              {T('freeCallSecondsRemaining', { type: 'number', min: 0, max: 100000 })}
            </Row>
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={isPending}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => {
                setForm(original);
                setOpen(false);
                setError(null);
              }}
              disabled={isPending}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
