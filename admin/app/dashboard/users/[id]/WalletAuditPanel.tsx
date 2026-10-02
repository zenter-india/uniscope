import { Card } from '../../../../components/ui';
import type { WalletBalanceAuditEntry } from './actions';

/** Plain server-rendered (no 'use client' needed — nothing interactive
 * here) section showing the DB-trigger-populated wallet_balance_audit
 * trail for this one user, right under WalletPanel. Deliberately renders
 * nothing when there's no history — the overwhelming majority of wallets
 * have never had a flagged change, and a permanent "no activity" card on
 * every single user page would just be noise. The system-wide "Wallet
 * Audit" nav page is the proactive catch-it-early view; this is the
 * in-context one for whoever is already looking at this specific user.
 * See the wallet-balance tamper detection note in CLAUDE.md for the full
 * incident this was built from. */
export function WalletAuditPanel({ entries }: { entries: WalletBalanceAuditEntry[] }) {
  if (entries.length === 0) return null;

  const unmatchedCount = entries.filter((e) => !e.matchedLedgerEntry).length;

  return (
    <Card className="border-amber-300 p-5 dark:border-amber-700/60">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Balance audit trail
        </h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Logged automatically by a database trigger on every change to this wallet&apos;s
          balance — the app itself never writes to this table.
          {unmatchedCount > 0 && (
            <span className="ml-1 font-medium text-amber-700 dark:text-amber-400">
              {unmatchedCount} change{unmatchedCount === 1 ? '' : 's'} below didn&apos;t land
              alongside a matching ledger entry — that&apos;s the signature of a direct database
              edit, not a real top-up, admin adjustment, or session settlement.
            </span>
          )}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="whitespace-nowrap py-2 pr-3 align-top text-zinc-500 dark:text-zinc-400">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="whitespace-nowrap py-2 pr-3 align-top tabular-nums text-zinc-800 dark:text-zinc-100">
                  {(e.oldBalanceMinor / 1000).toFixed(2)} → {(e.newBalanceMinor / 1000).toFixed(2)}{' '}
                  Uniminutes
                  <span
                    className={`ml-1 ${
                      e.deltaMinor < 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    ({e.deltaMinor > 0 ? '+' : ''}
                    {(e.deltaMinor / 1000).toFixed(2)})
                  </span>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 align-top text-zinc-500 dark:text-zinc-400">
                  role: {e.changedBy}
                </td>
                <td className="whitespace-nowrap py-2 align-top">
                  {e.matchedLedgerEntry ? (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Matched a ledger entry
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400">
                      ⚠ No matching ledger entry
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
