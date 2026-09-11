import { TableSkeleton } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';

export default function Loading() {
  return (
    <DashboardShell title="Enrollment Leads" email={null}>
      <TableSkeleton rows={8} cols={6} />
    </DashboardShell>
  );
}
