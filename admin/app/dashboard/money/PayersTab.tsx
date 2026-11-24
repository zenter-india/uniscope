import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { Table } from '../../../components/ui';
import { PLATFORM_LABEL, fmtWhen, inr, nf, pct, shownName } from './days';
import type { MoneyPayers } from './types';
import { EmptyBox, SectionHeading, ShareBar, SmallNumbers, Stat, Unavailable } from './ui';

/** Who pays, what they buy, and the biggest payers. Real payments only. */
export async function PayersTab({
  rangeQs,
  windowText,
}: {
  rangeQs: string;
  windowText: string;
}) {
  const data = await backendFetch<MoneyPayers>(`/admin/money/payers?${rangeQs}`).catch(
    () => null,
  );
  if (!data) return <Unavailable what="The payers figures" />;
  const { stats: s, packs, topPayers } = data;

  const everShare = s.aspirants > 0 ? s.payersEver / s.aspirants : null;
  const averageRupees = s.topups > 0 ? s.paidMinor / s.topups : null;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeading
          title="Who pays"
          hint={`People who made a real payment in ${windowText}. A "new" payer made their very first payment in this range.`}
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat
            label="People who paid"
            value={nf(s.payers)}
            sub={`${nf(s.newPayers)} new · ${nf(s.returningPayers)} came back`}
          />
          <Stat
            label="Paid more than once"
            value={`${nf(s.repeatInRange)} of ${nf(s.payers)}`}
            sub={
              s.payers > 0
                ? `${pct(s.repeatInRange / s.payers)} of the people who paid, in this range`
                : 'Nobody paid in this range'
            }
          />
          <Stat
            label="Ever paid"
            value={`${nf(s.payersEver)} of ${nf(s.aspirants)}`}
            sub={`${pct(everShare, 1)} of active aspirant accounts have ever paid · ${nf(s.repeatEver)} of them more than once`}
          />
          <Stat
            label="Average top-up"
            value={
              s.averageUniminutes === null ? '—' : `${s.averageUniminutes} Uniminutes`
            }
            sub={averageRupees === null ? undefined : `About ${inr(averageRupees)} per top-up`}
          />
        </div>
        {s.payersEver < 30 && (
          <div className="mt-3">
            <SmallNumbers />
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          title="Which pack sells"
          hint="Top-ups by the number of Uniminutes bought, for this range."
        />
        {packs.length === 0 ? (
          <EmptyBox>No top-ups in this range.</EmptyBox>
        ) : (
          <Table
            head={
              <tr>
                <Table.HeadCell>Pack</Table.HeadCell>
                <Table.HeadCell>Top-ups</Table.HeadCell>
                <Table.HeadCell>Share</Table.HeadCell>
                <Table.HeadCell>Android</Table.HeadCell>
                <Table.HeadCell>iOS</Table.HeadCell>
                <Table.HeadCell>Web</Table.HeadCell>
                <Table.HeadCell>Rupees paid</Table.HeadCell>
              </tr>
            }
          >
            {packs.map((p) => (
              <Table.Row key={p.uniminutes}>
                <Table.Cell className="font-medium text-zinc-900 dark:text-zinc-100">
                  {nf(p.uniminutes)} Uniminutes
                </Table.Cell>
                <Table.Cell>{nf(p.count)}</Table.Cell>
                <Table.Cell>
                  <ShareBar share={p.share} label={pct(p.share)} />
                </Table.Cell>
                <Table.Cell>{nf(p.byPlatform.android)}</Table.Cell>
                <Table.Cell>{nf(p.byPlatform.ios)}</Table.Cell>
                <Table.Cell>{nf(p.byPlatform.web)}</Table.Cell>
                <Table.Cell>{inr(p.paidMinor)}</Table.Cell>
              </Table.Row>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading
          title="Biggest payers"
          hint={`The ${topPayers.length || 10} people who bought the most Uniminutes in this range.`}
        />
        {topPayers.length === 0 ? (
          <EmptyBox>No top-ups in this range.</EmptyBox>
        ) : (
          <div className="flex flex-col gap-3">
            <Table
              head={
                <tr>
                  <Table.HeadCell>Person</Table.HeadCell>
                  <Table.HeadCell>Top-ups</Table.HeadCell>
                  <Table.HeadCell>Uniminutes</Table.HeadCell>
                  <Table.HeadCell>Rupees paid</Table.HeadCell>
                  <Table.HeadCell>Platforms</Table.HeadCell>
                  <Table.HeadCell>Last top-up</Table.HeadCell>
                </tr>
              }
            >
              {topPayers.map((p) => (
                <Table.Row key={p.userId}>
                  <Table.Cell>
                    <Link
                      href={`/dashboard/users/${p.userId}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {shownName(p.name)}
                    </Link>
                    {p.uniqueId && (
                      <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                        {p.uniqueId}
                      </span>
                    )}
                  </Table.Cell>
                  <Table.Cell>{nf(p.topups)}</Table.Cell>
                  <Table.Cell>{nf(p.uniminutes)}</Table.Cell>
                  <Table.Cell>{inr(p.paidMinor)}</Table.Cell>
                  <Table.Cell>{p.platforms.map((x) => PLATFORM_LABEL[x]).join(', ') || '—'}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                    {fmtWhen(p.lastAt)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              These are payments through the real payment systems. If the team tests with real money,
              those accounts appear here too — the ledger cannot tell them apart.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
