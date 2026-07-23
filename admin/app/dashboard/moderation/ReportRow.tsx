'use client';

import { useState, useTransition } from 'react';
import { resolveReport } from './actions';

const REASON_LABELS: Record<string, string> = {
  SPAM: 'Spam',
  MISINFORMATION: 'Misinformation',
  HARASSMENT: 'Harassment',
  IMPERSONATION: 'Impersonation',
  INAPPROPRIATE: 'Inappropriate content',
  ABUSIVE_LANGUAGE: 'Abusive language',
  OFF_PLATFORM_PAYMENT_REQUEST: 'Off-platform payment request',
  CALL_DROPPED: 'Call dropped mid-session',
  OTHER: 'Other',
};

interface ReportRowData {
  id: string;
  reporterId: string;
  reporterDisplayName?: string;
  targetType: string;
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export function ReportRow({
  report,
  readOnly = false,
}: {
  report: ReportRowData;
  readOnly?: boolean;
}) {
  const [resolution, setResolution] = useState('');
  const [refund, setRefund] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canRefund = report.targetType === 'SESSION';

  const act = (status: 'RESOLVED' | 'DISMISSED') => {
    setError(null);
    const refundAmountMinor =
      status === 'RESOLVED' && refund ? Math.round(Number(refund) * 100) : undefined;

    if (refund && (Number.isNaN(refundAmountMinor) || (refundAmountMinor ?? 0) <= 0)) {
      setError('Refund amount must be a positive number');
      return;
    }

    startTransition(async () => {
      try {
        await resolveReport(report.id, status, resolution || undefined, refundAmountMinor);
        setResolved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not resolve report');
      }
    });
  };

  if (resolved) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-zinc-900">
            {REASON_LABELS[report.reason] ?? report.reason}
          </p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Reported by {report.reporterDisplayName ?? report.reporterId} · target:{' '}
            {report.targetType} {report.targetId}
          </p>
          {report.description && (
            <p className="mt-2 rounded-lg bg-zinc-50 p-2 text-sm text-zinc-700">
              &ldquo;{report.description}&rdquo;
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-400">
            {new Date(report.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      {!readOnly && (
        <>
          <input
            type="text"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Resolution note"
            className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />

          {canRefund && (
            <input
              type="number"
              min="1"
              step="1"
              value={refund}
              onChange={(e) => setRefund(e.target.value)}
              placeholder="Refund amount in ₹ (optional — credited as Uniminutes)"
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => act('RESOLVED')}
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Resolve{refund ? ' + refund' : ''}
            </button>
            <button
              onClick={() => act('DISMISSED')}
              disabled={isPending}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        </>
      )}
    </div>
  );
}
