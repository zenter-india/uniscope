import { TableSkeleton } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';

export default function Loading() {
  return (
    <DashboardShell title="Admins" email={null}>
      <TableSkeleton rows={4} cols={6} />
    </DashboardShell>
  );
}
