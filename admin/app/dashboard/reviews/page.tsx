import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { ReviewsList } from './ReviewsList';
import type { ModeratedReview } from './actions';

const TYPE_TABS = ['mentor', 'university'] as const;
const STATUS_TABS = ['ALL', 'ACTIVE', 'HIDDEN', 'REMOVED'] as const;

function buildHref(p: { type: string; status?: string; search?: string }) {
  const qs = new URLSearchParams({ type: p.type });
  if (p.status && p.status !== 'ALL') qs.set('status', p.status);
  if (p.search) qs.set('search', p.search);
  return `/dashboard/reviews?${qs.toString()}`;
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; search?: string }>;
}) {
  const { type: rawType, status: rawStatus, search } = await searchParams;
  const type = TYPE_TABS.includes(rawType as (typeof TYPE_TABS)[number])
    ? (rawType as 'mentor' | 'university')
    : 'mentor';
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus!
    : 'ALL';

  const params = new URLSearchParams({ type, limit: '20' });
  if (status !== 'ALL') params.set('status', status);
  if (search) params.set('search', search);

  const [email, page] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: ModeratedReview[]; nextCursor: string | null }>(
      `/admin/reviews?${params.toString()}`,
    ).catch(() => ({ data: [] as ModeratedReview[], nextCursor: null })),
  ]);

  return (
    <DashboardShell title="Reviews" email={email}>
      <form className="mb-4 flex gap-2" action="/dashboard/reviews">
        <input type="hidden" name="type" value={type} />
        {status !== 'ALL' && <input type="hidden" name="status" value={status} />}
        <input
          type="text"
          name="search"
          defaultValue={search ?? ''}
          placeholder="Search review text…"
          className="w-80 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Search
        </button>
      </form>

      <div className="mb-2 flex flex-wrap gap-2">
        {TYPE_TABS.map((t) => (
          <Link
            key={t}
            href={buildHref({ type: t, status, search })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              type === t
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {t === 'mentor' ? 'Mentor reviews' : 'College reviews'}
          </Link>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => (
          <Link
            key={s}
            href={buildHref({ type, status: s, search })}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${
              status === s
                ? 'bg-zinc-700 text-white'
                : 'border border-zinc-200 text-zinc-500 hover:bg-zinc-100'
            }`}
          >
            {s === 'ALL' ? 'Any status' : s}
          </Link>
        ))}
      </div>

      <ReviewsList
        key={`${type}|${status}|${search ?? ''}`}
        initialItems={page.data}
        initialCursor={page.nextCursor}
        filters={{ type, status, search }}
      />
    </DashboardShell>
  );
}
