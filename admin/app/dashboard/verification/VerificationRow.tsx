'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card } from '../../../components/ui';
import { getVerificationDocumentUrl, reviewVerificationRequest } from './actions';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  STUDENT_ID: 'Student ID',
  STUDENT_PORTAL_SCREENSHOT: 'Student portal screenshot',
  DEGREE_CERTIFICATE: 'Degree certificate',
  NMC_REGISTRATION: 'NMC registration',
};

interface Applicant {
  displayName: string;
  realName: string | null;
  role: string;
  gender: string | null;
  state: string | null;
  city: string | null;
  stream: string | null;
  qualification: string | null;
  specialization: string | null;
  courseInterested: string | null;
  yearOfStudy: number | null;
  graduationYear: number | null;
  yearInfoPrivate: boolean;
  dateOfBirth: string | null;
  languages: string[];
  availableDays: string[];
  goals: string[];
  bio: string | null;
  specialty: string | null;
  preferredLanguage: string | null;
  preferredMentorshipTiming: string | null;
}

export interface VerificationRequestRow {
  id: string;
  userId: string;
  userDisplayName?: string;
  universityId: string;
  universityName?: string;
  documentType: string;
  status: string;
  submittedAt: string | null;
  applicant?: Applicant;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-sm text-zinc-800">{value}</p>
    </div>
  );
}

export function VerificationRow({ request }: { request: VerificationRequestRow }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const viewDocument = () => {
    setError(null);
    startTransition(async () => {
      try {
        setDocUrl(await getVerificationDocumentUrl(request.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load document');
      }
    });
  };

  const decide = (approve: boolean) => {
    setError(null);
    startTransition(async () => {
      try {
        await reviewVerificationRequest(request.id, approve, note || undefined);
        setResolved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not submit review');
      }
    });
  };

  if (resolved) return null;

  const a = request.applicant;
  const year =
    a?.yearOfStudy != null
      ? `Year ${a.yearOfStudy}${a.yearInfoPrivate ? ' (private)' : ''}`
      : a?.graduationYear != null
        ? `Graduating ${a.graduationYear}${a.yearInfoPrivate ? ' (private)' : ''}`
        : null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left"
        >
          <p className="font-medium text-zinc-900">
            {request.userDisplayName ?? request.userId}
            {a && <Badge className="ml-2">{a.role}</Badge>}
          </p>
          <p className="mt-0.5 text-sm text-zinc-500">
            {request.universityName ?? request.universityId} ·{' '}
            {DOCUMENT_TYPE_LABELS[request.documentType] ?? request.documentType}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Submitted{' '}
            {request.submittedAt ? new Date(request.submittedAt).toLocaleString() : '—'}
            {a ? ` · ${expanded ? 'hide details' : 'show details'}` : ''}
          </p>
        </button>
        <Button size="sm" onClick={viewDocument} disabled={isPending}>
          View document
        </Button>
      </div>

      {expanded && a && (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-zinc-100 pt-4 sm:grid-cols-3">
          <Field label="Real name" value={a.realName} />
          <Field
            label="Date of birth"
            value={a.dateOfBirth ? new Date(a.dateOfBirth).toLocaleDateString() : null}
          />
          <Field label="Gender" value={a.gender} />
          <Field label="State" value={a.state} />
          <Field label="City" value={a.city} />
          <Field label="Stream / Field" value={a.stream} />
          <Field label="Qualification / Degree" value={a.qualification} />
          <Field label="Specialization" value={a.specialization} />
          <Field label="Course interested" value={a.courseInterested} />
          <Field label="Year" value={year} />
          <Field label="Languages" value={a.languages.join(', ')} />
          <Field label="Available days" value={a.availableDays.join(', ')} />
          <Field label="Goals" value={a.goals.join(', ')} />
          <Field label="Specialty" value={a.specialty} />
          <Field label="Preferred language" value={a.preferredLanguage} />
          <Field label="Preferred mentorship timing" value={a.preferredMentorshipTiming} />
          {a.bio && (
            <div className="col-span-2 sm:col-span-3">
              <Field label="Bio" value={a.bio} />
            </div>
          )}
        </div>
      )}

      {docUrl && (
        <a
          href={docUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block overflow-hidden rounded-lg border border-zinc-200"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={docUrl} alt="Verification document" className="max-h-64 w-full object-contain" />
        </a>
      )}

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (shown to the user if rejected)"
        className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <Button variant="successSolid" onClick={() => decide(true)} disabled={isPending}>
          Approve
        </Button>
        <Button variant="dangerSolid" onClick={() => decide(false)} disabled={isPending}>
          Reject
        </Button>
      </div>
    </Card>
  );
}
