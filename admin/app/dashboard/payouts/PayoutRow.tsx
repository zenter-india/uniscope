'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card, toneFor } from '../../../components/ui';
import { processPayout } from './actions';

export interface PayoutRowData {
  id: string;
  mentorId: string;
  mentorName?: string;
  amountMinor: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  periodStart: string;
  periodEnd: string;
  bankReference: string | null;
  processedAt: string | null;
  createdAt: string;
  isOverdue: boolean;
  mentorWalletBalanceMinor?: number | null;
}

function rupees(minor: number): string {
  return (minor / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

function fmtDate(v: string | null): string {
  return v ? new Date(v).toLocaleDateString() : '—';
}

export function PayoutRow({ payout }: { payout: PayoutRowData }) {
  const [status, setStatus] = useState(payout.status);
  const [processedAt, setProcessedAt] = useState(payout.processedAt);
  const [savedRef, setSavedRef] = useState(payout.bankReference);
  const [error, setError] = useState<string | null>(null);
  const [refInput, setRefInput] = useState('');
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [isPending, startTransition] = useTransition();

  const open = status === 'PENDING' || status === 'PROCESSING';
  const shortBalance =
    payout.mentorWalletBalanceMinor != null &&
    payout.mentorWalletBalanceMinor < payout.amountMinor;

  const move = (next: 'PROCESSING' | 'COMPLETED' | 'FAILED', ref?: string) => {
    setError(null);
    startTransition(async () => {
      const res = await processPayout(payout.id, next, ref);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatus(next);
      setConfirmingPaid(false);
      if (next !== 'PROCESSING') setProcessedAt(new Date().toISOString());
      if (ref?.trim()) setSavedRef(ref.trim());
    });
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-zinc-900">
              {payout.mentorName ?? payout.mentorId}
            </p>
            <Badge tone={toneFor(status)}>{status}</Badge>
            {payout.isOverdue && open && <Badge tone="danger">Overdue</Badge>}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Earnings {fmtDate(payout.periodStart)} – {fmtDate(payout.periodEnd)} · requested{' '}
            {new Date(payout.createdAt).toLocaleString()}
          </p>
          <p className="mt-0.5 font-mono text-xs text-zinc-300">{payout.mentorId}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-zinc-900">{rupees(payout.amountMinor)}</p>
          {payout.mentorWalletBalanceMinor != null && (
            <p className={`text-xs ${shortBalance ? 'text-red-600' : 'text-zinc-400'}`}>
              wallet {rupees(payout.mentorWalletBalanceMinor)}
              {shortBalance ? ' · short' : ''}
            </p>
          )}
        </div>
      </div>

      {!open && (processedAt || savedRef) && (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-sm text-zinc-500">
          {processedAt ? `${status === 'COMPLETED' ? 'Paid' : 'Closed'} ${new Date(processedAt).toLocaleString()}` : ''}
          {savedRef ? ` · ref ${savedRef}` : ''}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {open && (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          {confirmingPaid ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-600">
                Confirm the bank transfer of {rupees(payout.amountMinor)} to{' '}
                <span className="font-medium text-zinc-900">
                  {payout.mentorName ?? 'this mentor'}
                </span>{' '}
                has gone through. This debits their wallet.
              </p>
              {shortBalance && (
                <p className="text-sm text-red-600">
                  Their wallet balance is below the payout amount — the backend will
                  reject this until it&apos;s investigated.
                </p>
              )}
              <input
                type="text"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="Bank / UTR reference (optional)"
                className="w-72 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40"
              />
              <div className="flex gap-2">
                <Button
                  variant="successSolid"
                  onClick={() => move('COMPLETED', refInput)}
                  disabled={isPending}
                >
                  {isPending ? 'Saving…' : 'Confirm paid'}
                </Button>
                <Button onClick={() => setConfirmingPaid(false)} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {status === 'PENDING' && (
                <Button size="sm" onClick={() => move('PROCESSING')} disabled={isPending}>
                  Mark processing
                </Button>
              )}
              <Button
                size="sm"
                variant="successSolid"
                onClick={() => setConfirmingPaid(true)}
                disabled={isPending}
              >
                Mark paid
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => move('FAILED')}
                disabled={isPending}
              >
                Mark failed
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
