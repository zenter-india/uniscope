import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { FilterTabs } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import { ReviewsList } from './ReviewsList';
import type { ModeratedReview } from './actions';

const TYPE_TABS = ['mentor', 'university'] as const;
const STATUS_TABS = ['ALL', 'ACTIVE', 'HIDDEN', 'REMOVED'] as const;

const SORT_KEYS = ['created', 'rating', 'status'];

function buildHref(p: {
  type: string;
  status?: string;
  search?: string;
  sort?: string;
  dir?: string;
}) {
  const qs = new URLSearchParams({ type: p.type });
  if (p.status && p.status !== 'ALL') qs.set('status', p.status);
  if (p.search) qs.set('search', p.search);
  if (p.sort) qs.set('sort', p.sort);
  if (p.dir) qs.set('dir', p.dir);
  return `/dashboard/reviews?${qs.toString()}`;
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    status?: string;
    search?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { type: rawType, status: rawStatus, search, sort: rawSort, dir: rawDir } =
    await searchParams;
  const type = TYPE_TABS.includes(rawType as (typeof TYPE_TABS)[number])
    ? (rawType as 'mentor' | 'university')
    : 'mentor';
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus!
    : 'ALL';
  const sort = rawSort && SORT_KEYS.includes(rawSort) ? rawSort : undefined;
  const dir = rawDir === 'asc' ? 'asc' : sort ? 'desc' : undefined;

  const params = new URLSearchParams({ type, limit: '20' });
  if (status !== 'ALL') params.set('status', status);
  if (search) params.set('search', search);
  if (sort) params.set('sortBy', sort);
  if (dir) params.set('sortDir', dir);

  const [email, page] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: ModeratedReview[]; nextCursor: string | null }>(
      `/admin/reviews?${params.toString()}`,
    ).catch(() => ({ data: [] as ModeratedReview[], nextCursor: null })),
  ]);

  return (
    <DashboardShell title="Reviews" email={email}>
      <div className="mb-5 flex flex-col gap-3">
        <form className="flex gap-2" action="/dashboard/reviews">
          <input type="hidden" name="type" value={type} />
          {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="search"
            defaultValue={search ?? ''}
            placeholder="Search review text…"
            className="w-80 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40"
          />
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterTabs
            items={TYPE_TABS}
            current={type}
            hrefFor={(t) => buildHref({ type: t, status, search, sort, dir })}
            labelFor={(t) => (t === 'mentor' ? 'Mentor reviews' : 'College reviews')}
          />
          <FilterTabs
            size="sm"
            items={STATUS_TABS}
            current={status as (typeof STATUS_TABS)[number]}
            hrefFor={(s) => buildHref({ type, status: s, search, sort, dir })}
            labelFor={(s) => (s === 'ALL' ? 'Any status' : s)}
          />
        </div>
      </div>

      <ReviewsList
        key={`${type}|${status}|${search ?? ''}|${sort ?? ''}|${dir ?? ''}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ type, status, search, sort, dir }}
      />
    </DashboardShell>
  );
}
