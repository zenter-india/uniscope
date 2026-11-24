import { backendFetch } from '../../../lib/backend';
import { Card } from '../../../components/ui';
import { PLATFORM_LABEL, inr, nf } from './days';
import { TrendChart } from './TrendChart';
import type { MoneyPlatformSummary, MoneySummary, MoneyTrend, Platform } from './types';
import { Delta, SectionHeading, Stat, Unavailable } from './ui';

const PLATFORM_COLOR: Record<Platform, string> = {
  android: '#10b981',
  ios: '#3b82f6',
  web: '#f59e0b',
};
const ORDER: Platform[] = ['android', 'ios', 'web'];

function PlatformCard({ p }: { p: MoneyPlatformSummary }) {
  const none = p.count === 0;
  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: PLATFORM_COLOR[p.platform] }}
        />
        {PLATFORM_LABEL[p.platform]}
      </h3>
      <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {nf(p.uniminutes)} <span className="text-sm font-medium text-zinc-500">Uniminutes</span>
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {none
          ? 'No top-ups in this range'
          : `${nf(p.count)} top-up${p.count === 1 ? '' : 's'} · ${nf(p.users)} user${p.users === 1 ? '' : 's'}`}
      </p>
      {!none && (
        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
          {p.paidKnown > 0 ? `${inr(p.paidMinor)} paid` : 'Rupee price unknown'}
          {p.paidKnown > 0 && p.paidKnown < p.count && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {' '}
              · price known for {p.paidKnown} of {p.count}
            </span>
          )}
        </p>
      )}
      {p.platform === 'ios' && !none && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          What customers paid through the App Store, before Apple&apos;s cut.
        </p>
      )}
      {p.platform === 'web' && none && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          Shows up once the website wallet is live.
        </p>
      )}
    </Card>
  );
}

export async function OverviewTab({
  rangeQs,
  windowText,
}: {
  rangeQs: string;
  windowText: string;
}) {
  const [s, trend] = await Promise.all([
    backendFetch<MoneySummary>(`/admin/money/summary?${rangeQs}`).catch(() => null),
    backendFetch<MoneyTrend>(`/admin/money/trend?${rangeQs}`).catch(() => null),
  ]);
  if (!s) return <Unavailable what="Money figures" />;
  const prev = s.previous;

  const notes = [
    `Mentors hold ${inr(s.mentorBalanceMinor)} in their wallets right now${
      s.mentorsOwed > 0 ? ` (${nf(s.mentorsOwed)} mentor${s.mentorsOwed === 1 ? '' : 's'})` : ''
    }, whatever the range.`,
    s.topups.notPayments.count > 0 &&
      `Not counted as money in: ${nf(s.topups.notPayments.count)} test, Apple test-mode or refunded credit${s.topups.notPayments.count === 1 ? '' : 's'} (${nf(s.topups.notPayments.uniminutes)} Uniminutes). They are in the ledger, but no money moved.`,
    s.manualEarnings.count > 0 &&
      `Not counted as mentor earnings: ${inr(s.manualEarnings.minor)} credited to mentors that was not for a call (manual test earnings).`,
    s.adjustments.count > 0 &&
      `Admin balance adjustments in this range: ${[
        s.adjustments.creditsMinor > 0 ? `${inr(s.adjustments.creditsMinor)} added` : null,
        s.adjustments.debitsMinor > 0 ? `${inr(s.adjustments.debitsMinor)} taken back` : null,
      ]
        .filter(Boolean)
        .join(', ')} (${nf(s.adjustments.count)} entr${s.adjustments.count === 1 ? 'y' : 'ies'}) — not revenue.`,
  ].filter(Boolean) as string[];

  const byPlatform = ORDER.map((p) => s.topups.byPlatform.find((x) => x.platform === p)!);
  const points = trend?.points ?? [];

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionHeading
          title="Money in"
          hint={`Real payments only, for ${windowText}. Days are counted in UTC.`}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {byPlatform.map((p) => (
            <PlatformCard key={p.platform} p={p} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat
            label="Top-ups"
            value={nf(s.topups.count)}
            sub={`${nf(s.topups.uniminutes)} Uniminutes sold`}
            delta={<Delta current={s.topups.count} previous={prev.topups.count} />}
          />
          <Stat
            label="Rupees paid"
            value={inr(s.topups.paidMinor)}
            sub="Android and iOS, before Apple's cut"
            delta={<Delta current={s.topups.paidMinor} previous={prev.topups.paidMinor} />}
          />
          <Stat
            label="Mentor earnings"
            value={inr(s.mentorEarnings.earnedMinor)}
            sub={`${nf(s.mentorEarnings.sessions)} call${s.mentorEarnings.sessions === 1 ? '' : 's'} · ${nf(s.mentorEarnings.mentors)} mentor${s.mentorEarnings.mentors === 1 ? '' : 's'}`}
            delta={
              <Delta current={s.mentorEarnings.earnedMinor} previous={prev.mentorEarnedMinor} />
            }
          />
          <Stat
            label="Payouts paid"
            value={inr(s.payoutsPaidMinor)}
            sub={
              s.refundsMinor > 0 ? `Refunds: ${inr(s.refundsMinor)}` : 'To mentors, in this range'
            }
            delta={
              <Delta current={s.payoutsPaidMinor} previous={prev.payoutsPaidMinor} neutral />
            }
          />
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading
          title="Over time"
          hint={
            trend
              ? `One bar per ${trend.unit}. Hover a bar for its numbers.`
              : undefined
          }
        />
        {!trend ? (
          <Unavailable what="The charts" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
            <TrendChart
              title="Rupees paid"
              hint="By platform, before Apple's cut."
              unit={trend.unit}
              series={ORDER.map((p) => ({ name: PLATFORM_LABEL[p], color: PLATFORM_COLOR[p] }))}
              bars={points.map((p) => ({
                bucket: p.bucket,
                values: ORDER.map((k) => p.paidByPlatformMinor[k]),
              }))}
              format={inr}
            />
            <TrendChart
              title="Uniminutes sold"
              hint="By platform."
              unit={trend.unit}
              series={ORDER.map((p) => ({ name: PLATFORM_LABEL[p], color: PLATFORM_COLOR[p] }))}
              bars={points.map((p) => ({
                bucket: p.bucket,
                values: ORDER.map((k) => p.uniminutes[k]),
              }))}
              format={(n) => `${nf(n)} Uniminutes`}
            />
            <div className="lg:col-span-2">
              <TrendChart
                title="Mentor earnings"
                hint="Paid for calls, as they happened."
                unit={trend.unit}
                series={[{ name: 'Earned', color: '#8b5cf6' }]}
                bars={points.map((p) => ({
                  bucket: p.bucket,
                  values: [p.mentorEarnedMinor],
                }))}
                format={inr}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
