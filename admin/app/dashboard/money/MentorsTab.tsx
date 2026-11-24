import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { Table } from '../../../components/ui';
import { inr, nf, pct, shownName } from './days';
import type { MoneyMentors } from './types';
import { EXPORT_LINK, EmptyBox, SectionHeading, Stat, Unavailable } from './ui';

/** Which mentor earned how much, and how earnings are spread across them. */
export async function MentorsTab({
  rangeQs,
  windowText,
}: {
  rangeQs: string;
  windowText: string;
}) {
  const mentors = await backendFetch<MoneyMentors>(`/admin/money/mentors?${rangeQs}`).catch(
    () => null,
  );
  if (!mentors) return <Unavailable what="The mentor list" />;
  const { stats: st } = mentors;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeading
          title="How earnings are spread"
          hint={`Earnings from calls in ${windowText}.`}
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat
            label="Mentors earning"
            value={nf(st.mentorsEarning)}
            sub={`${inr(st.totalEarnedMinor)} earned in total`}
          />
          <Stat
            label="Top mentor's share"
            value={pct(st.topOneShare)}
            sub="Of everything mentors earned"
          />
          <Stat
            label="Top 3 mentors' share"
            value={pct(st.topThreeShare)}
            sub="A high number means earnings depend on few mentors"
          />
          <Stat
            label="Earned per call"
            value={st.averagePerCallMinor === null ? '—' : inr(st.averagePerCallMinor)}
            sub="Average across all mentors"
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="Mentor earnings"
          hint={`Mentors with earnings or payouts in ${windowText}, biggest earner first.`}
        >
          <a href={`/dashboard/money/export?kind=mentors&${rangeQs}`} className={EXPORT_LINK}>
            Export CSV
          </a>
        </SectionHeading>
        {mentors.data.length === 0 ? (
          <EmptyBox>No mentor earned or was paid out in this range.</EmptyBox>
        ) : (
          <div className="flex flex-col gap-3">
            <Table
              head={
                <tr>
                  <Table.HeadCell>Mentor</Table.HeadCell>
                  <Table.HeadCell>Calls</Table.HeadCell>
                  <Table.HeadCell>Minutes</Table.HeadCell>
                  <Table.HeadCell>Earned</Table.HeadCell>
                  <Table.HeadCell>Paid out</Table.HeadCell>
                  <Table.HeadCell>Balance now</Table.HeadCell>
                </tr>
              }
            >
              {mentors.data.map((m) => (
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
                  <Table.Cell>{nf(m.sessions)}</Table.Cell>
                  <Table.Cell>{nf(m.minutes)}</Table.Cell>
                  <Table.Cell className="font-medium text-zinc-900 dark:text-zinc-100">
                    {inr(m.earnedMinor)}
                  </Table.Cell>
                  <Table.Cell>{inr(m.paidOutMinor)}</Table.Cell>
                  <Table.Cell>{inr(m.balanceMinor)}</Table.Cell>
                </Table.Row>
              ))}
            </Table>
            {mentors.truncated && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Only the top {nf(mentors.data.length)} mentors are shown. Narrow the range, or export
                the CSV for the full list.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
