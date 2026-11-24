import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { Card, Table } from '../../../components/ui';
import { fmtDate, inr, nf, shownName, uniminutes } from './days';
import type { BalanceKind, MoneyBalanceBreakdown, MoneyBalances } from './types';
import { EmptyBox, SectionHeading, Unavailable } from './ui';

const KIND_LABEL: Record<BalanceKind, string> = {
  BOUGHT: 'Bought (real payments)',
  TEST_CREDIT: 'Test or manual credits (not payments)',
  MANUAL_EARNINGS: 'Manual earnings credits (not for a call)',
  SESSION_DEBIT: 'Spent on calls',
  SESSION_CREDIT: 'Earned from calls',
  PAYOUT: 'Paid out',
  ADJUSTMENT: 'Admin adjustments',
  REFUND: 'Refunds',
  HOLD_RELEASE: 'Released holds',
};

/** Signed Uniminutes with their rupee value ("+2,811 Uniminutes · ₹28,110"). */
const signed = (minor: number) =>
  `${uniminutes(minor, true)} Uniminutes · ${minor < 0 ? '−' : ''}${inr(Math.abs(minor))}`;

function Breakdown({
  title,
  holder,
  b,
}: {
  title: string;
  holder: string;
  b: MoneyBalanceBreakdown;
}) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {uniminutes(b.balanceMinor)}{' '}
        <span className="text-sm font-medium text-zinc-500">Uniminutes</span>
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {inr(b.balanceMinor)} of call value · {nf(b.wallets)} {holder} holding something
      </p>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Where it came from, over all time
      </p>
      <ul className="mt-2 flex flex-col divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        {b.lines.map((l) => (
          <li key={l.kind} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="text-zinc-700 dark:text-zinc-300">
              {KIND_LABEL[l.kind]}
              <span className="ml-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                {nf(l.entries)} entr{l.entries === 1 ? 'y' : 'ies'}
              </span>
            </span>
            <span
              className={`whitespace-nowrap tabular-nums ${
                l.minor < 0 ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {signed(l.minor)}
            </span>
          </li>
        ))}
        {b.unexplainedMinor !== 0 && (
          <li className="flex items-baseline justify-between gap-3 py-1.5 text-amber-700 dark:text-amber-400">
            <span>Not in the ledger</span>
            <span className="whitespace-nowrap tabular-nums">{signed(b.unexplainedMinor)}</span>
          </li>
        )}
      </ul>
      {b.unexplainedMinor !== 0 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {uniminutes(Math.abs(b.unexplainedMinor))} Uniminutes of the balance have no ledger entry
          behind them: a wallet balance was set outside the ledger, for example by editing the
          database. Worth checking who made it and why.
        </p>
      )}
    </Card>
  );
}

/** What aspirants and mentors hold, where it came from, and who is owed. */
export async function BalancesTab() {
  const data = await backendFetch<MoneyBalances>('/admin/money/balances').catch(() => null);
  if (!data) return <Unavailable what="The balances" />;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeading
          title="What is held"
          hint="Balances are as of now, so the date range does not apply here."
        />
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          <Breakdown title="Aspirants hold" holder="wallets" b={data.aspirants} />
          <Breakdown title="Mentors hold" holder="wallets" b={data.mentors} />
        </div>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          1 Uniminute is ₹10 of call value. A balance is mostly free credit when admin adjustments
          are its biggest line: those Uniminutes were added by an admin, not bought.
        </p>
      </section>

      <section>
        <SectionHeading
          title="Mentors who are owed"
          hint="What each mentor holds now, and how long it has been building up since their last payout."
        />
        {data.owedMentors.length === 0 ? (
          <EmptyBox>No mentor is owed anything right now.</EmptyBox>
        ) : (
          <Table
            head={
              <tr>
                <Table.HeadCell>Mentor</Table.HeadCell>
                <Table.HeadCell>Owed</Table.HeadCell>
                <Table.HeadCell>Last payout</Table.HeadCell>
                <Table.HeadCell>Building up since</Table.HeadCell>
                <Table.HeadCell>Days</Table.HeadCell>
              </tr>
            }
          >
            {data.owedMentors.map((m) => (
              <Table.Row key={m.id}>
                <Table.Cell>
                  <Link
                    href={`/dashboard/users/${m.id}`}
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {shownName(m.name)}
                  </Link>
                  {m.uniqueId && (
                    <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                      {m.uniqueId}
                    </span>
                  )}
                </Table.Cell>
                <Table.Cell className="font-medium text-zinc-900 dark:text-zinc-100">
                  {inr(m.balanceMinor)}
                </Table.Cell>
                <Table.Cell>{m.lastPayoutAt ? fmtDate(m.lastPayoutAt) : 'Never'}</Table.Cell>
                <Table.Cell>{m.owedSince ? fmtDate(m.owedSince) : '—'}</Table.Cell>
                <Table.Cell>{m.daysOwed === null ? '—' : nf(m.daysOwed)}</Table.Cell>
              </Table.Row>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
