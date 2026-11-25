import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { Button, FilterTabs, Input } from '../../../components/ui';
import { PLATFORMS, PLATFORM_LABEL, moneyQueryString, pageHref } from './days';
import { TopupsTable } from './TopupsTable';
import type { MoneyQuery, MoneyTopup, Platform } from './types';
import { EXPORT_LINK, SectionHeading, Unavailable } from './ui';

const PLATFORM_TABS = ['all', ...PLATFORMS] as const;

/** Who recharged, on which platform, for how many minutes. Newest first. */
export async function TopupsTab({
  range,
  platform,
  q,
}: {
  /** The range alone: a rolling `days`, or a custom `from` and `to`. */
  range: MoneyQuery;
  platform?: Platform;
  q?: string;
}) {
  const filters: MoneyQuery = { ...range, platform, q };
  const tableQs = moneyQueryString(filters);
  const topups = await backendFetch<{ data: MoneyTopup[]; nextCursor: string | null }>(
    `/admin/money/topups?${tableQs}`,
  ).catch(() => null);

  return (
    <section>
      <SectionHeading
        title="Top-ups"
        hint="Who recharged, on which platform, for how many minutes. Newest first."
      >
        <a href={`/dashboard/money/export?${tableQs}`} className={EXPORT_LINK}>
          Export CSV
        </a>
      </SectionHeading>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <FilterTabs
          items={PLATFORM_TABS}
          current={platform ?? 'all'}
          hrefFor={(p) => pageHref({ ...range, platform: p === 'all' ? undefined : p, q }, 'topups')}
          labelFor={(p) => (p === 'all' ? 'All' : PLATFORM_LABEL[p])}
          size="sm"
        />
        <form method="get" action="/dashboard/money" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value="topups" />
          {range.from && range.to ? (
            <>
              <input type="hidden" name="from" value={range.from} />
              <input type="hidden" name="to" value={range.to} />
            </>
          ) : (
            <input type="hidden" name="days" value={range.days ?? 30} />
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
              href={pageHref({ ...range, platform }, 'topups')}
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
        <Unavailable what="The top-ups list" />
      )}
    </section>
  );
}
