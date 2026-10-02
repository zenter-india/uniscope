import Link from 'next/link';
import { getAdminEmail } from '../../../lib/adminAuth';
import { Badge, EmptyState, Table } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import { getUnreconciledWallets } from './actions';

function money(minor: number): string {
  return (minor / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

export default async function WalletAuditPage() {
  const [email, { wallets, error }] = await Promise.all([
    getAdminEmail(),
    getUnreconciledWallets(),
  ]);

  return (
    <DashboardShell title="Wallet Audit" email={email}>
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        Every wallet whose current balance doesn&apos;t sum-match its own ledger history — the
        real signature of a direct database edit that bypassed the app&apos;s normal
        top-up/adjustment/session-settlement paths. Built 2026-10-02 after exactly that was found
        on a real account with no application-level trace of how it happened. See the
        &ldquo;Wallet-balance tamper detection&rdquo; note in CLAUDE.md for the full incident.
      </p>

      {error ? (
        <EmptyState icon="alert">Could not load this list — {error}</EmptyState>
      ) : wallets.length === 0 ? (
        <EmptyState icon="check">
          Every wallet currently reconciles with its own ledger history. Nothing to review.
        </EmptyState>
      ) : (
        <Table
          head={
            <tr>
              <Table.HeadCell>User</Table.HeadCell>
              <Table.HeadCell>Role</Table.HeadCell>
              <Table.HeadCell>Wallet balance</Table.HeadCell>
              <Table.HeadCell>Ledger sum</Table.HeadCell>
              <Table.HeadCell>Unexplained</Table.HeadCell>
            </tr>
          }
        >
          {wallets.map((w) => (
            <Table.Row key={w.walletId}>
              <Table.Cell className="font-medium text-zinc-900 dark:text-zinc-100">
                {w.user ? (
                  <Link
                    href={`/dashboard/users/${w.user.id}`}
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {w.user.displayName}
                  </Link>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500">
                    (no linked user — wallet {w.walletId})
                  </span>
                )}
                {w.user?.uniqueId && (
                  <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {w.user.uniqueId}
                  </span>
                )}
              </Table.Cell>
              <Table.Cell>
                {w.user ? <Badge tone="neutral">{w.user.role}</Badge> : '—'}
              </Table.Cell>
              <Table.Cell className="tabular-nums">{money(w.balanceMinor)}</Table.Cell>
              <Table.Cell className="tabular-nums">{money(w.ledgerSumMinor)}</Table.Cell>
              <Table.Cell>
                <Badge tone="danger">{money(w.unexplainedMinor)}</Badge>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table>
      )}
    </DashboardShell>
  );
}
