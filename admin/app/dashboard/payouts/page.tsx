import Link from 'next/link';
import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { PayoutRow, type PayoutRowData } from './PayoutRow';

const STATUS_TABS = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ALL'] as const;

function rupees(minor: number): string {
  return (minor / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus!
    : 'PENDING';

  const [email, rows] = await Promise.all([
    getAdminEmail(),
    backendFetch<PayoutRowData[]>(
      `/payouts${status === 'ALL' ? '' : `?status=${status}`}`,
    ).catch(() => [] as PayoutRowData[]),
  ]);

  const openTotal = rows
    .filter((r) => r.status === 'PENDING' || r.status === 'PROCESSING')
    .reduce((sum, r) => sum + r.amountMinor, 0);

  return (
    <DashboardShell title="Payouts" email={email}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/payouts?status=${tab}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              status === tab
                ? 'bg-zinc-900 text-white'
                : 'border border-zinc-300 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </Link>
        ))}
        {openTotal > 0 && (
          <span className="ml-auto text-sm text-zinc-500">
            {rupees(openTotal)} awaiting payout
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {status === 'PENDING'
            ? 'No payout requests waiting. Mentors request these from their Earnings tab.'
            : 'No payout requests in this status.'}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((payout) => (
            <PayoutRow key={payout.id} payout={payout} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
