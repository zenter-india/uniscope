import { getAdminEmail } from '../../../lib/adminAuth';
import { FilterTabs } from '../../../components/ui';
import { CustomRangePicker } from '../CustomRangePicker';
import { DashboardShell } from '../DashboardShell';
import { BalancesTab } from './BalancesTab';
import { MentorsTab } from './MentorsTab';
import { OverviewTab } from './OverviewTab';
import { PayersTab } from './PayersTab';
import { TopupsTab } from './TopupsTab';
import { UsageTab } from './UsageTab';
import {
  PLATFORMS,
  RANGES,
  TABS,
  TAB_LABEL,
  fmtSpan,
  isRealDay,
  isTab,
  moneyQueryString,
  pageHref,
  rangeLabel,
  todayUtc,
  windowLabel,
} from './days';
import type { MoneyQuery, Platform } from './types';

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    days?: string;
    from?: string;
    to?: string;
    platform?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const today = todayUtc();
  const tab = isTab(sp.tab) ? sp.tab : 'overview';

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
  const rangeQs = moneyQueryString(range);
  // The top-ups filters only mean something on the top-ups screen.
  const filters = tab === 'topups' ? { platform, q } : {};
  // What a new range should not reset: the screen, and on top-ups its filters.
  const keep: Record<string, string> = {
    ...(tab !== 'overview' ? { tab } : {}),
    ...(filters.platform ? { platform: filters.platform } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };

  const email = await getAdminEmail();
  const windowText = custom ? fmtSpan(custom.from, custom.to) : windowLabel(days);

  return (
    <DashboardShell title="Money" email={email}>
      <div className="mb-5">
        <FilterTabs
          items={TABS}
          current={tab}
          hrefFor={(t) => pageHref(range, t)}
          labelFor={(t) => TAB_LABEL[t]}
        />
      </div>

      {tab !== 'balances' && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Range
          </span>
          <FilterTabs
            items={RANGES}
            current={custom ? null : (days as (typeof RANGES)[number])}
            hrefFor={(r) => pageHref({ days: r, ...filters }, tab)}
            labelFor={rangeLabel}
          />
          <CustomRangePicker
            key={`${tab}|${custom ? `${custom.from}|${custom.to}` : 'preset'}`}
            from={custom?.from ?? ''}
            to={custom?.to ?? ''}
            today={today}
            label={custom ? fmtSpan(custom.from, custom.to) : ''}
            action="/dashboard/money"
            keep={keep}
            compared={false}
          />
        </div>
      )}

      {tab === 'overview' && <OverviewTab rangeQs={rangeQs} windowText={windowText} />}
      {tab === 'topups' && <TopupsTab range={range} platform={platform} q={q} />}
      {tab === 'payers' && <PayersTab rangeQs={rangeQs} windowText={windowText} />}
      {tab === 'mentors' && <MentorsTab rangeQs={rangeQs} windowText={windowText} />}
      {tab === 'balances' && <BalancesTab />}
      {tab === 'usage' && <UsageTab rangeQs={rangeQs} windowText={windowText} />}
    </DashboardShell>
  );
}
