import { TableSkeleton } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';

export default function Loading() {
  return (
    <DashboardShell title="Payouts" email={null}>
      <TableSkeleton rows={6} cols={4} />
    </DashboardShell>
  );
}
