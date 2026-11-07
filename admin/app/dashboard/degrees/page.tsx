import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { CustomDegreesList } from './CustomDegreesList';
import type { CustomDegree, CustomDegreeStatus } from './actions';

const TABS: { status: CustomDegreeStatus; label: string }[] = [
  { status: 'PENDING', label: 'Pending' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Rejected' },
];

export default async function CustomDegreesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: raw } = await searchParams;
  const status: CustomDegreeStatus =
    raw === 'APPROVED' || raw === 'REJECTED' ? raw : 'PENDING';

  const [email, page] = await Promise.all([
    getAdminEmail(),
    backendFetch<{ data: CustomDegree[]; nextCursor: string | null }>(
      `/admin/custom-degrees?status=${status}&limit=50`,
    ).catch(() => ({ data: [] as CustomDegree[], nextCursor: null })),
  ]);

  return (
    <DashboardShell title="Custom degrees" email={email}>
      <p className="mb-5 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
        Degrees and courses people typed under “Others” while creating their profile. Approve one
        and it appears as a normal option in that stream’s degree list for everyone from then on;
        reject spam or typos. You can fix the spelling before approving.
      </p>

      <div className="mb-4 flex items-center gap-1.5">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/dashboard/degrees?status=${tab.status}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              status === tab.status
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <CustomDegreesList
        key={status}
        status={status}
        initialItems={page.data}
        initialCursor={page.nextCursor}
      />
    </DashboardShell>
  );
}
