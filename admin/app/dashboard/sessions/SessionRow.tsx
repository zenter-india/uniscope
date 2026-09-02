'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { forceEndSession, type SessionRowData } from './actions';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-sky-100 text-sky-700',
  RINGING: 'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-zinc-100 text-zinc-600',
  REJECTED: 'bg-zinc-100 text-zinc-600',
  EXPIRED: 'bg-zinc-100 text-zinc-600',
  FAILED: 'bg-red-100 text-red-700',
};

const TERMINAL = new Set(['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED']);

function rupees(minor: number): string {
  return (minor / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

function fmt(v: string | null): string {
  return v ? new Date(v).toLocaleString() : '—';
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-800">
        {value === null || value === undefined || value === '' ? (
          <span className="text-zinc-300">—</span>
        ) : (
          value
        )}
      </p>
    </div>
  );
}

export function SessionRow({ session }: { session: SessionRowData }) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(session.status);
  const [endReason, setEndReason] = useState(session.endReason);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCall = session.type === 'AUDIO_CALL';
  const canForceEnd = !TERMINAL.has(status);

  const forceEnd = () => {
    setError(null);
    startTransition(async () => {
      const res = await forceEndSession(session.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatus(res.status as SessionRowData['status']);
      setEndReason('ADMIN_CLOSED');
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-900">{session.aspirantName}</span>
          <span className="text-zinc-400">→</span>
          <span className="font-medium text-zinc-900">{session.mentorName}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isCall ? 'bg-violet-100 text-violet-700' : 'bg-teal-100 text-teal-700'
            }`}
          >
            {isCall ? 'Call' : 'Chat'}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {status.replace('_', ' ')}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Requested {fmt(session.requestedAt)}
          {isCall && session.callSlotMinutes ? ` · ${session.callSlotMinutes} min slot` : ''}
          {session.totalCostMinor > 0 ? ` · ${rupees(session.totalCostMinor)}` : ''}
          {endReason ? ` · ${endReason.replace(/_/g, ' ').toLowerCase()}` : ''}
        </p>
      </button>

      {expanded && (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-zinc-100 pt-4 sm:grid-cols-3">
          <Field
            label="Aspirant"
            value={
              <Link
                href={`/dashboard/users/${session.aspirantId}`}
                className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
              >
                {session.aspirantName}
              </Link>
            }
          />
          <Field
            label="Mentor"
            value={
              <Link
                href={`/dashboard/users/${session.mentorId}`}
                className="text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
              >
                {session.mentorName}
              </Link>
            }
          />
          <Field label="Type" value={isCall ? 'Audio call' : 'Chat'} />
          <Field label="Requested" value={fmt(session.requestedAt)} />
          <Field label="Mentor responded" value={fmt(session.respondedAt)} />
          <Field label="Started" value={fmt(session.startedAt)} />
          <Field label="Ended" value={fmt(session.endedAt)} />
          <Field label="End reason" value={endReason} />
          {isCall && (
            <>
              <Field label="Slot" value={session.callSlotMinutes ? `${session.callSlotMinutes} min` : null} />
              <Field label="Billed minutes" value={session.billedMinutes || null} />
              <Field label="Total charged" value={session.totalCostMinor ? rupees(session.totalCostMinor) : null} />
              <Field label="Aspirant joined" value={fmt(session.aspirantJoinedAt)} />
              <Field label="Mentor joined" value={fmt(session.mentorJoinedAt)} />
            </>
          )}
          <Field label="Session ID" value={<span className="font-mono text-xs">{session.id}</span>} />

          <div className="col-span-2 sm:col-span-3">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            {canForceEnd ? (
              <button
                onClick={forceEnd}
                disabled={isPending}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {isPending ? 'Ending…' : 'Force end session'}
              </button>
            ) : (
              <p className="text-xs text-zinc-400">Session is finished — nothing to force-end.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
