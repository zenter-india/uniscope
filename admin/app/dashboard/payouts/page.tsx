import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { FilterTabs, Table } from '../../../components/ui';
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
        <FilterTabs
          items={STATUS_TABS}
          current={status as (typeof STATUS_TABS)[number]}
          hrefFor={(tab) => `/dashboard/payouts?status=${tab}`}
          labelFor={(tab) => (tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase())}
        />
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
        <Table
          head={
            <tr>
              <Table.HeadCell>Mentor</Table.HeadCell>
              <Table.HeadCell>Amount</Table.HeadCell>
              <Table.HeadCell>Status</Table.HeadCell>
              <Table.HeadCell>Earnings period</Table.HeadCell>
              <Table.HeadCell className="w-8" />
            </tr>
          }
        >
          {rows.map((payout) => (
            <PayoutRow key={payout.id} payout={payout} />
          ))}
        </Table>
      )}
    </DashboardShell>
  );
}
