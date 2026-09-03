import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { BroadcastPanel } from './BroadcastPanel';
import { listBroadcasts, type Broadcast } from './actions';

export default async function BroadcastsPage() {
  const [email, history] = await Promise.all([
    getAdminEmail(),
    listBroadcasts().catch(() => [] as Broadcast[]),
  ]);

  return (
    <DashboardShell title="Announcements" email={email}>
      <BroadcastPanel initialHistory={history} />
    </DashboardShell>
  );
}
