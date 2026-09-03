import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { FilterTabs, Table } from '../../../components/ui';
import { SortableHeader } from '../../../components/SortableHeader';
import { DashboardShell } from '../DashboardShell';
import { PayoutRow, type PayoutRowData } from './PayoutRow';

const STATUS_TABS = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ALL'] as const;
const SORT_KEYS = ['amount', 'status', 'period', 'requested'];

function rupees(minor: number): string {
  return (minor / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; dir?: string }>;
}) {
  const { status: rawStatus, sort: rawSort, dir: rawDir } = await searchParams;
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? rawStatus!
    : 'PENDING';
  const sort = rawSort && SORT_KEYS.includes(rawSort) ? rawSort : undefined;
  const dir = rawDir === 'asc' ? 'asc' : sort ? 'desc' : undefined;

  const q = new URLSearchParams();
  if (status !== 'ALL') q.set('status', status);
  if (sort) q.set('sortBy', sort);
  if (dir) q.set('sortDir', dir);

  const [email, rows] = await Promise.all([
    getAdminEmail(),
    backendFetch<PayoutRowData[]>(
      `/payouts${q.toString() ? `?${q.toString()}` : ''}`,
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
          hrefFor={(tab) => {
            const p = new URLSearchParams({ status: tab });
            if (sort) p.set('sort', sort);
            if (dir) p.set('dir', dir);
            return `/dashboard/payouts?${p.toString()}`;
          }}
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
              <SortableHeader label="Amount" sortKey="amount" />
              <SortableHeader label="Status" sortKey="status" />
              <SortableHeader label="Earnings period" sortKey="period" />
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
