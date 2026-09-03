'use client';

import { useState, useTransition } from 'react';
import { Button, Card, fieldClass } from '../../../../components/ui';
import { adjustBalance, loadMoreLedger, type LedgerEntryData } from './actions';

const TYPE_LABELS: Record<string, string> = {
  TOPUP: 'Top-up',
  SESSION_DEBIT: 'Session charge',
  SESSION_CREDIT: 'Session earning',
  REFUND: 'Refund',
  HOLD_RELEASE: 'Hold released',
  ADJUSTMENT: 'Admin adjustment',
  PAYOUT: 'Payout',
};

function money(minor: number): string {
  const sign = minor < 0 ? '−' : '+';
  return `${sign}${Math.abs(minor / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
  })}`;
}

function balance(minor: number): string {
  return `${(minor / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
  })} · ${(minor / 1000).toFixed(2)} Uniminutes`;
}

export function WalletPanel({
  userId,
  initialBalanceMinor,
  initialEntries,
  initialCursor,
}: {
  userId: string;
  initialBalanceMinor: number;
  initialEntries: LedgerEntryData[];
  initialCursor: string | null;
}) {
  const [balanceMinor, setBalanceMinor] = useState(initialBalanceMinor);
  const [entries, setEntries] = useState(initialEntries);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [rupees, setRupees] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [reason, setReason] = useState('');
  const [adjustErr, setAdjustErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const more = () => {
    if (!cursor) return;
    setLoadErr(null);
    startTransition(async () => {
      try {
        const next = await loadMoreLedger(userId, cursor);
        setEntries((prev) => [...prev, ...next.data]);
        setCursor(next.nextCursor);
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : 'Could not load more');
      }
    });
  };

  const submit = () => {
    setAdjustErr(null);
    setDone(null);
    const amount = Math.round(Number(rupees) * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      setAdjustErr('Enter an amount greater than zero.');
      return;
    }
    if (reason.trim().length < 3) {
      setAdjustErr('A reason is required (min 3 characters).');
      return;
    }
    const signed = direction === 'debit' ? -amount : amount;
    startTransition(async () => {
      const res = await adjustBalance(userId, signed, reason.trim());
      if (!res.ok) {
        setAdjustErr(res.error);
        return;
      }
      setBalanceMinor(res.balanceMinor);
      setEntries((prev) => [
        {
          id: `local-${Date.now()}`,
          type: 'ADJUSTMENT',
          amountMinor: signed,
          balanceAfterMinor: res.balanceMinor,
          sessionId: null,
          note: `Admin adjustment — ${reason.trim()}`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setRupees('');
      setReason('');
      setFormOpen(false);
      setDone(`Balance ${direction === 'debit' ? 'reduced' : 'increased'} by ${money(signed)}.`);
    });
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Wallet</h2>
          <p className="mt-1 text-lg font-semibold text-zinc-900">{balance(balanceMinor)}</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setFormOpen((v) => !v);
            setAdjustErr(null);
            setDone(null);
          }}
        >
          {formOpen ? 'Cancel' : 'Adjust balance'}
        </Button>
      </div>

      {done && <p className="mb-3 text-sm text-emerald-600">{done}</p>}

      {formOpen && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex overflow-hidden rounded-lg border border-zinc-300">
              {(['credit', 'debit'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    direction === d
                      ? d === 'credit'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                      : 'bg-white text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {d === 'credit' ? 'Credit (add)' : 'Debit (remove)'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-zinc-500">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rupees}
                onChange={(e) => setRupees(e.target.value)}
                placeholder="0.00"
                className={`${fieldClass} w-28`}
              />
            </div>
            {Number(rupees) > 0 && (
              <span className="text-xs text-zinc-400">
                = {(Number(rupees) / 10).toFixed(2)} Uniminutes
              </span>
            )}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason (recorded on the ledger entry) — e.g. goodwill credit for dropped call #…"
            className={fieldClass}
          />
          {adjustErr && <p className="text-sm text-red-600">{adjustErr}</p>}
          <div>
            <Button variant="primary" onClick={submit} disabled={isPending}>
              {isPending ? 'Applying…' : 'Apply adjustment'}
            </Button>
          </div>
        </div>
      )}

      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
        Transactions
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-400">No wallet activity yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3 align-top text-zinc-500 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <span className="font-medium text-zinc-800">
                      {TYPE_LABELS[e.type] ?? e.type}
                    </span>
                    {e.note && <p className="text-xs text-zinc-400">{e.note}</p>}
                  </td>
                  <td
                    className={`py-2 pr-3 text-right align-top font-medium tabular-nums whitespace-nowrap ${
                      e.amountMinor < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {money(e.amountMinor)}
                  </td>
                  <td className="py-2 text-right align-top text-zinc-500 tabular-nums whitespace-nowrap">
                    {(e.balanceAfterMinor / 100).toLocaleString('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loadErr && <p className="mt-2 text-sm text-red-600">{loadErr}</p>}
      {cursor && (
        <Button size="sm" onClick={more} disabled={isPending} className="mt-3">
          {isPending ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </Card>
  );
}
