'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { getLeadDocumentUrl, updateLead } from './actions';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  STUDENT_ID: 'College / Student ID card',
  STUDENT_PORTAL_SCREENSHOT: 'Admission order',
  DEGREE_CERTIFICATE: 'Degree certificate',
  NMC_REGISTRATION: 'Registration certificate',
};

const STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-amber-100 text-amber-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
};

const STATUS_OPTIONS = ['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED'] as const;

export interface LeadRowData {
  id: string;
  role: 'ASPIRANT' | 'MENTOR';
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'REJECTED';
  fullName: string;
  phone: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  state: string | null;
  city: string | null;
  stream: string | null;
  qualification: string | null;
  courseInterested: string | null;
  preferredLanguage: string | null;
  preferredMentorshipTiming: string | null;
  alias: string | null;
  universityId: string | null;
  universityName?: string;
  collegeName: string | null;
  degree: string | null;
  specialization: string | null;
  currentStatus: string | null;
  yearOfStudy: number | null;
  graduationYear: number | null;
  yearInfoPrivate: boolean;
  languages: string[];
  availableDays: string[];
  documentType: string;
  hasDocument: boolean;
  convertedUserId: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
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

export function LeadRow({ lead }: { lead: LeadRowData }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(lead.adminNote ?? '');
  const [status, setStatus] = useState(lead.status);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const viewDocument = () => {
    setError(null);
    startTransition(async () => {
      try {
        setDocUrl(await getLeadDocumentUrl(lead.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load document');
      }
    });
  };

  const save = (nextStatus?: (typeof STATUS_OPTIONS)[number]) => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateLead(lead.id, {
          status: nextStatus ?? status,
          adminNote: note,
        });
        if (nextStatus) setStatus(nextStatus);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save');
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-zinc-900">{lead.fullName}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                lead.role === 'MENTOR' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
              }`}
            >
              {lead.role === 'MENTOR' ? 'Mentor' : 'Student'}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
              {status}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">
            {lead.phone}
            {lead.email ? ` · ${lead.email}` : ''}
            {lead.alias ? ` · alias: ${lead.alias}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Submitted {new Date(lead.createdAt).toLocaleString()}
          </p>
        </button>
        {lead.hasDocument && (
          <button
            onClick={viewDocument}
            disabled={isPending}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            View document
          </button>
        )}
      </div>

      {docUrl && (
        <a
          href={docUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block overflow-hidden rounded-lg border border-zinc-200"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={docUrl} alt="Uploaded document" className="max-h-64 w-full object-contain" />
        </a>
      )}

      {expanded && (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-zinc-100 pt-4 sm:grid-cols-3">
          <Field label="Email" value={lead.email} />
          <Field
            label="Date of birth"
            value={lead.dateOfBirth ? new Date(lead.dateOfBirth).toLocaleDateString() : null}
          />
          <Field label="Gender" value={lead.gender} />
          <Field label="State" value={lead.state} />
          <Field label="City" value={lead.city} />
          <Field label="Stream / Field" value={lead.stream} />
          <Field label="Alias" value={lead.alias} />
          {lead.role === 'ASPIRANT' ? (
            <>
              <Field label="Qualification" value={lead.qualification} />
              <Field label="Course interested" value={lead.courseInterested} />
              <Field label="Specialization" value={lead.specialization} />
              <Field label="Preferred language" value={lead.preferredLanguage} />
              <Field label="Preferred mentorship timing" value={lead.preferredMentorshipTiming} />
            </>
          ) : (
            <>
              <Field label="College" value={lead.universityName ?? lead.collegeName} />
              <Field label="Degree" value={lead.degree} />
              <Field label="Specialization" value={lead.specialization} />
              <Field label="Current status" value={lead.currentStatus} />
              <Field
                label="Year of study"
                value={lead.yearOfStudy ? `Year ${lead.yearOfStudy}${lead.yearInfoPrivate ? ' (private)' : ''}` : null}
              />
              <Field
                label="Graduation year"
                value={
                  lead.graduationYear
                    ? `${lead.graduationYear}${lead.yearInfoPrivate ? ' (private)' : ''}`
                    : null
                }
              />
              <Field label="Languages" value={lead.languages.join(', ')} />
              <Field label="Available days" value={lead.availableDays.join(', ')} />
              <Field label="Document type" value={DOCUMENT_TYPE_LABELS[lead.documentType]} />
            </>
          )}
          <Field
            label="Converted account"
            value={
              lead.convertedUserId ? (
                <Link
                  href={`/dashboard/users/${lead.convertedUserId}`}
                  className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
                >
                  View user
                </Link>
              ) : null
            }
          />
          <Field label="Last updated" value={new Date(lead.updatedAt).toLocaleString()} />
        </div>
      )}

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Admin note (internal only)"
          rows={2}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {saved && !error && <p className="mt-2 text-sm text-emerald-600">Saved.</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_OPTIONS.filter((s) => s !== status).map((s) => (
            <button
              key={s}
              onClick={() => save(s)}
              disabled={isPending}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Mark {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
          <button
            onClick={() => save()}
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
