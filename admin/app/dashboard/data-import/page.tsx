import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { listJobs } from './actions';
import { DataImportPanel } from './DataImportPanel';

export default async function DataImportPage() {
  const [email, jobs] = await Promise.all([
    getAdminEmail(),
    listJobs().catch(() => []),
  ]);

  return (
    <DashboardShell title="Data Import" email={email}>
      <DataImportPanel initialJobs={jobs} />
    </DashboardShell>
  );
}
