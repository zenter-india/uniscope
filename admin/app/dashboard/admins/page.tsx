import { getAdminEmail } from '../../../lib/adminAuth';
import { PageHeader } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import { AdminsList } from './AdminsList';
import { getAdminAccounts } from './actions';

export default async function AdminsPage() {
  const [email, accounts] = await Promise.all([
    getAdminEmail(),
    getAdminAccounts().catch(() => []),
  ]);

  return (
    <DashboardShell title="Admins" email={email}>
      <PageHeader
        title="Admins"
        description="Who can sign into this panel. The root credential (env vars) always works and can't be removed here; everyone else is a row below."
      />
      <AdminsList initial={accounts} rootEmail={process.env.ADMIN_EMAIL ?? null} />
    </DashboardShell>
  );
}
