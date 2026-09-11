import { TableSkeleton } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';

export default function Loading() {
  return (
    <DashboardShell title="Verification" email={null}>
      <TableSkeleton rows={6} cols={5} />
    </DashboardShell>
  );
}
