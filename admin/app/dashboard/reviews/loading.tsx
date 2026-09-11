import { TableSkeleton } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';

export default function Loading() {
  return (
    <DashboardShell title="Reviews" email={null}>
      <TableSkeleton rows={8} cols={5} />
    </DashboardShell>
  );
}
