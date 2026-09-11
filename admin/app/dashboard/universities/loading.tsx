import { TableSkeleton } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';

export default function Loading() {
  return (
    <DashboardShell title="Universities" email={null}>
      <TableSkeleton rows={8} cols={4} />
    </DashboardShell>
  );
}
