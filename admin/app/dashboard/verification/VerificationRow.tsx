'use client';

import { useState, useTransition } from 'react';
import { getVerificationDocumentUrl, reviewVerificationRequest } from './actions';

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  STUDENT_ID: 'Student ID',
  STUDENT_PORTAL_SCREENSHOT: 'Student portal screenshot',
  DEGREE_CERTIFICATE: 'Degree certificate',
  NMC_REGISTRATION: 'NMC registration',
};

interface VerificationRequestRow {
  id: string;
  userId: string;
  userDisplayName?: string;
  universityId: string;
  universityName?: string;
  documentType: string;
  status: string;
  submittedAt: string | null;
}

export function VerificationRow({ request }: { request: VerificationRequestRow }) {
  const [note, setNote] = useState('');
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const viewDocument = () => {
    setError(null);
    startTransition(async () => {
      try {
        const url = await getVerificationDocumentUrl(request.id);
        setDocUrl(url);
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

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-900">
            {request.userDisplayName ?? request.userId}
          </p>
          <p className="mt-0.5 text-sm text-zinc-500">
            {request.universityName ?? request.universityId} ·{' '}
            {DOCUMENT_TYPE_LABELS[request.documentType] ?? request.documentType}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Submitted{' '}
            {request.submittedAt
              ? new Date(request.submittedAt).toLocaleString()
              : '—'}
          </p>
        </div>
        <button
          onClick={viewDocument}
          disabled={isPending}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          View document
        </button>
      </div>

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
        className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => decide(true)}
          disabled={isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => decide(false)}
          disabled={isPending}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
