'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Badge, Button, toneFor } from '../../../components/ui';
import { ExpandableRow } from '../../../components/ExpandableRow';
import { SessionTranscript } from './SessionTranscript';
import { forceEndSession, type SessionRowData } from './actions';

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
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
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
    <ExpandableRow
      colSpan={5}
      cells={[
        <span key="p" className="flex items-center gap-1.5">
          <span className="font-medium text-zinc-900">{session.aspirantName}</span>
          <span className="text-zinc-400">→</span>
          <span className="font-medium text-zinc-900">{session.mentorName}</span>
        </span>,
        <Badge key="t" tone={isCall ? 'info' : 'neutral'}>
          {isCall ? 'Call' : 'Chat'}
        </Badge>,
        <Badge key="s" tone={toneFor(status)}>
          {status.replace('_', ' ')}
        </Badge>,
        <span key="r" className="whitespace-nowrap text-xs text-zinc-500">
          {fmt(session.requestedAt)}
          {session.totalCostMinor > 0 ? ` · ${rupees(session.totalCostMinor)}` : ''}
        </span>,
      ]}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
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

          {!isCall && (
            <div className="col-span-2 sm:col-span-3">
              <SessionTranscript sessionId={session.id} />
            </div>
          )}

          <div className="col-span-2 sm:col-span-3">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            {canForceEnd ? (
              <Button size="sm" variant="danger" onClick={forceEnd} disabled={isPending}>
                {isPending ? 'Ending…' : 'Force end session'}
              </Button>
            ) : (
              <p className="text-xs text-zinc-400">Session is finished — nothing to force-end.</p>
            )}
          </div>
      </div>
    </ExpandableRow>
  );
}
