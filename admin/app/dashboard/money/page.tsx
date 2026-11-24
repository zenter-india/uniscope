import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { Button, Card, FilterTabs, Input, Table } from '../../../components/ui';
import { CustomRangePicker } from '../CustomRangePicker';
import { DashboardShell } from '../DashboardShell';
import { TopupsTable } from './TopupsTable';
import {
  PLATFORMS,
  PLATFORM_LABEL,
  RANGES,
  fmtSpan,
  inr,
  isRealDay,
  moneyQueryString,
  rangeLabel,
  shownName,
  todayUtc,
  windowLabel,
} from './days';
import type {
  MoneyMentor,
  MoneyPlatformSummary,
  MoneyQuery,
  MoneySummary,
  MoneyTopup,
  Platform,
} from './types';

const PLATFORM_TABS = ['all', ...PLATFORMS] as const;
const nf = (n: number) => n.toLocaleString('en-IN');

const EXPORT_LINK =
  'inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 max-md:h-10 max-md:text-sm';

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </Card>
  );
}

function PlatformCard({ p }: { p: MoneyPlatformSummary }) {
  const none = p.count === 0;
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
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
          {p.paidKnown > 0 ? `${inr(p.paidMinor)} paid` : 'Rupee price not recorded'}
          {p.paidKnown > 0 && p.paidKnown < p.count && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {' '}
              · recorded for {p.paidKnown} of {p.count}
            </span>
          )}
        </p>
      )}
      {p.platform === 'ios' && !none && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          The App Store sets the price and keeps its cut, so no rupee amount is recorded.
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

function SectionHeading({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{
    days?: string;
    from?: string;
    to?: string;
    platform?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const today = todayUtc();

  // Same rules as the Overview: a custom range needs two real days, in order,
  // not starting in the future; anything else falls back to the 30-day preset.
  const custom =
    isRealDay(sp.from) && isRealDay(sp.to) && sp.from <= sp.to && sp.from <= today
      ? { from: sp.from, to: sp.to > today ? today : sp.to }
      : null;
  const days = RANGES.includes(Number(sp.days) as (typeof RANGES)[number])
    ? Number(sp.days)
    : 30;
  const platform = PLATFORMS.includes(sp.platform as Platform)
    ? (sp.platform as Platform)
    : undefined;
  const q = sp.q?.trim().slice(0, 80) || undefined;

  const range: MoneyQuery = custom ? { from: custom.from, to: custom.to } : { days };
  const filters: MoneyQuery = { ...range, platform, q };
  const rangeQs = moneyQueryString(range);
  const tableQs = moneyQueryString(filters);
  const keep: Record<string, string> = {
    ...(platform ? { platform } : {}),
    ...(q ? { q } : {}),
  };
  const hrefWith = (over: MoneyQuery) => `/dashboard/money?${moneyQueryString(over)}`;

  const [email, summary, topups, mentors] = await Promise.all([
    getAdminEmail(),
    backendFetch<MoneySummary>(`/admin/money/summary?${rangeQs}`).catch(() => null),
    backendFetch<{ data: MoneyTopup[]; nextCursor: string | null }>(
      `/admin/money/topups?${tableQs}`,
    ).catch(() => null),
    backendFetch<{ data: MoneyMentor[]; truncated: boolean }>(
      `/admin/money/mentors?${rangeQs}`,
    ).catch(() => null),
  ]);

  const shown = summary?.range ?? custom;
  const windowText = shown ? fmtSpan(shown.from, shown.to) : windowLabel(days);

  return (
    <DashboardShell title="Money" email={email}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Range
        </span>
        <FilterTabs
          items={RANGES}
          current={custom ? null : (days as (typeof RANGES)[number])}
          hrefFor={(r) => hrefWith({ days: r, platform, q })}
          labelFor={rangeLabel}
        />
        <CustomRangePicker
          key={custom ? `${custom.from}|${custom.to}` : 'preset'}
          from={custom?.from ?? ''}
          to={custom?.to ?? ''}
          today={today}
          label={custom ? fmtSpan(custom.from, custom.to) : ''}
          action="/dashboard/money"
          keep={keep}
          compared={false}
        />
      </div>

      {!summary ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Money figures are unavailable right now — the backend didn&apos;t respond.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <SectionHeading
              title="Money in"
              hint={`Real payments only, for ${windowText}. Days are counted in UTC.`}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {summary.topups.byPlatform.map((p) => (
                <PlatformCard key={p.platform} p={p} />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Stat
                label="Top-ups"
                value={nf(summary.topups.count)}
                sub={`${nf(summary.topups.uniminutes)} Uniminutes sold`}
              />
              <Stat
                label="Rupees paid"
                value={inr(summary.topups.paidMinor)}
                sub="Razorpay only — iOS purchases have no recorded price"
              />
              <Stat
                label="Mentor earnings"
                value={inr(summary.mentorEarnings.earnedMinor)}
                sub={`${nf(summary.mentorEarnings.sessions)} call${summary.mentorEarnings.sessions === 1 ? '' : 's'} · ${nf(summary.mentorEarnings.mentors)} mentor${summary.mentorEarnings.mentors === 1 ? '' : 's'}`}
              />
              <Stat
                label="Payouts paid"
                value={inr(summary.payoutsPaidMinor)}
                sub={
                  summary.refundsMinor > 0
                    ? `Refunds: ${inr(summary.refundsMinor)}`
                    : 'To mentors, in this range'
                }
              />
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Mentors hold {inr(summary.mentorBalanceMinor)} in their wallets right now
              {summary.mentorsOwed > 0
                ? ` (${nf(summary.mentorsOwed)} mentor${summary.mentorsOwed === 1 ? '' : 's'})`
                : ''}
              , whatever the range.
              {summary.topups.notPayments.count > 0 &&
                ` Not counted above: ${nf(summary.topups.notPayments.count)} test or manual credit${summary.topups.notPayments.count === 1 ? '' : 's'} (${nf(summary.topups.notPayments.uniminutes)} Uniminutes) — they are in the ledger but were not payments.`}
              {summary.adjustments.count > 0 &&
                ` Admin balance adjustments in this range: ${[
                  summary.adjustments.creditsMinor > 0
                    ? `${inr(summary.adjustments.creditsMinor)} added`
                    : null,
                  summary.adjustments.debitsMinor > 0
                    ? `${inr(summary.adjustments.debitsMinor)} taken back`
                    : null,
                ]
                  .filter(Boolean)
                  .join(', ')} (${nf(summary.adjustments.count)} entr${summary.adjustments.count === 1 ? 'y' : 'ies'}) — not revenue.`}
            </p>
          </section>

          <section>
            <SectionHeading
              title="Top-ups"
              hint="Who recharged, on which platform, for how many minutes. Newest first."
            >
              <a href={`/dashboard/money/export?kind=topups&${tableQs}`} className={EXPORT_LINK}>
                Export CSV
              </a>
            </SectionHeading>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <FilterTabs
                items={PLATFORM_TABS}
                current={platform ?? 'all'}
                hrefFor={(p) => hrefWith({ ...range, platform: p === 'all' ? undefined : p, q })}
                labelFor={(p) => (p === 'all' ? 'All' : PLATFORM_LABEL[p])}
                size="sm"
              />
              <form
                method="get"
                action="/dashboard/money"
                className="flex flex-wrap items-center gap-2"
              >
                {custom ? (
                  <>
                    <input type="hidden" name="from" value={custom.from} />
                    <input type="hidden" name="to" value={custom.to} />
                  </>
                ) : (
                  <input type="hidden" name="days" value={days} />
                )}
                {platform && <input type="hidden" name="platform" value={platform} />}
                <Input
                  name="q"
                  defaultValue={q ?? ''}
                  maxLength={80}
                  placeholder="Search a user's alias or ID"
                  aria-label="Search top-ups by user"
                  className="w-56"
                />
                <Button type="submit" size="sm">
                  Search
                </Button>
                {q && (
                  <Link
                    href={hrefWith({ ...range, platform })}
                    className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
                  >
                    Clear
                  </Link>
                )}
              </form>
            </div>
            {topups ? (
              <TopupsTable
                key={tableQs}
                query={filters}
                initialRows={topups.data}
                initialCursor={topups.nextCursor}
              />
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                The top-ups list is unavailable right now.
              </p>
            )}
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
            {!mentors ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                The mentor list is unavailable right now.
              </p>
            ) : mentors.data.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No mentor earned or was paid out in this range.
              </p>
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
                    Only the top {nf(mentors.data.length)} mentors are shown. Narrow the range, or
                    export the CSV for the full list.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
