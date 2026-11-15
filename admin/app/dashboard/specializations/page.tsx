import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { CollegeSpecializationsList } from './CollegeSpecializationsList';
import type { SpecializationSuggestion, SuggestionStatus } from './actions';

const TABS: { status: SuggestionStatus; label: string }[] = [
  { status: 'PENDING', label: 'Pending' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Rejected' },
];

export default async function CollegeSpecializationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: raw } = await searchParams;
  const status: SuggestionStatus =
    raw === 'APPROVED' || raw === 'REJECTED' ? raw : 'PENDING';

  const [email, page] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: SpecializationSuggestion[]; nextCursor: string | null }>(
      `/admin/specialization-suggestions?status=${status}&limit=50`,
    ).catch(() => ({ data: [] as SpecializationSuggestion[], nextCursor: null })),
  ]);

  return (
    <DashboardShell title="College specializations" email={email}>
      <p className="mb-5 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
        Specializations mentors entered for their own college that the college&apos;s list
        doesn&apos;t have yet — typed under “Not listed here”, or picked from the wider list
        (a new college starts with an empty list, so its first mentor&apos;s choice shows up
        here). Approve one and it is added to that college&apos;s list for everyone from then on;
        if the college is new, approving also publishes it. You can fix the spelling first.
      </p>

      <div className="mb-4 flex items-center gap-1.5">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/dashboard/specializations?status=${tab.status}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors max-md:py-2.5 ${
              status === tab.status
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <CollegeSpecializationsList
        key={status}
        status={status}
        initialItems={page.data}
        initialCursor={page.nextCursor}
      />
    </DashboardShell>
  );
}
