import { backendFetch } from '../../../lib/backend';
import { Table } from '../../../components/ui';
import { inr, nf, pct } from './days';
import { TrendChart } from './TrendChart';
import type { MoneyTrend, MoneyUsage, UsageOutcome } from './types';
import { EmptyBox, SectionHeading, ShareBar, Stat, Unavailable } from './ui';

const OUTCOME: Record<UsageOutcome, { label: string; hint: string }> = {
  billed: { label: 'Billed calls', hint: 'Connected and charged' },
  declined: { label: 'Declined by the mentor', hint: 'Nothing charged' },
  cancelled: { label: 'Cancelled by the student', hint: 'Nothing charged' },
  aspirant_no_show: {
    label: "Student didn't join",
    hint: 'A no-show fee is charged',
  },
  mentor_no_show: { label: "Mentor didn't join", hint: 'Nothing charged' },
  not_connected: {
    label: 'Ended without a billed call',
    hint: 'Not answered, or ended before it connected',
  },
  open: { label: 'Still open', hint: 'Waiting, accepted or in progress' },
};

/** What happened to call requests: how many ended in a billed call, and how the
 * rest ended. */
export async function UsageTab({
  rangeQs,
  windowText,
}: {
  rangeQs: string;
  windowText: string;
}) {
  const [u, trend] = await Promise.all([
    backendFetch<MoneyUsage>(`/admin/money/usage?${rangeQs}`).catch(() => null),
    backendFetch<MoneyTrend>(`/admin/money/trend?${rangeQs}`).catch(() => null),
  ]);
  if (!u) return <Unavailable what="The usage figures" />;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeading
          title="Calls"
          hint={`Call requests made in ${windowText}. Chat is free, so only calls are counted here.`}
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat
            label="Call requests"
            value={nf(u.requested)}
            sub={`${nf(u.callers)} student${u.callers === 1 ? '' : 's'} asked`}
          />
          <Stat
            label="Billed calls"
            value={nf(u.billedCalls)}
            sub={
              u.billedShare === null
                ? undefined
                : `${pct(u.billedShare)} of requests ended in a billed call`
            }
          />
          <Stat
            label="Minutes billed"
            value={nf(u.billedMinutes)}
            sub={`${inr(u.billedCostMinor)} charged · ${nf(u.mentorsCalled)} mentor${u.mentorsCalled === 1 ? '' : 's'} spoke`}
          />
          <Stat
            label="Average billed call"
            value={u.averageBilledMinutes === null ? '—' : `${u.averageBilledMinutes} min`}
            sub="Minutes per billed call"
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="How requests ended"
          hint="Every request lands in exactly one row."
        />
        {u.requested === 0 ? (
          <EmptyBox>No call was requested in this range.</EmptyBox>
        ) : (
          <Table
            head={
              <tr>
                <Table.HeadCell>Outcome</Table.HeadCell>
                <Table.HeadCell>Requests</Table.HeadCell>
                <Table.HeadCell>Share</Table.HeadCell>
                <Table.HeadCell>Minutes</Table.HeadCell>
                <Table.HeadCell>Charged</Table.HeadCell>
              </tr>
            }
          >
            {u.outcomes.map((o) => (
              <Table.Row key={o.outcome}>
                <Table.Cell>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {OUTCOME[o.outcome].label}
                  </span>
                  <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {OUTCOME[o.outcome].hint}
                  </span>
                </Table.Cell>
                <Table.Cell>{nf(o.count)}</Table.Cell>
                <Table.Cell>
                  <ShareBar share={o.count / u.requested} label={pct(o.count / u.requested)} />
                </Table.Cell>
                <Table.Cell>{nf(o.minutes)}</Table.Cell>
                <Table.Cell>{o.costMinor > 0 ? inr(o.costMinor) : '—'}</Table.Cell>
              </Table.Row>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionHeading title="Over time" />
        {!trend ? (
          <Unavailable what="The charts" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
            <TrendChart
              title="Billed calls"
              hint="Calls that were charged, by the day they were billed."
              unit={trend.unit}
              series={[{ name: 'Billed calls', color: '#10b981' }]}
              bars={trend.points.map((p) => ({ bucket: p.bucket, values: [p.calls] }))}
              format={(n) => `${nf(n)} call${n === 1 ? '' : 's'}`}
            />
            <TrendChart
              title="Minutes billed"
              hint="Call minutes charged."
              unit={trend.unit}
              series={[{ name: 'Minutes', color: '#3b82f6' }]}
              bars={trend.points.map((p) => ({ bucket: p.bucket, values: [p.minutes] }))}
              format={(n) => `${nf(n)} min`}
            />
          </div>
        )}
      </section>
    </div>
  );
}
