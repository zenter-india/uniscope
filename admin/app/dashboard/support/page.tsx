import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { SupportInbox } from './SupportInbox';
import { listSupportChannels, type SupportChannelSummary } from './actions';

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const [email, channels] = await Promise.all([
    getAdminEmail(),
    listSupportChannels().catch(() => [] as SupportChannelSummary[]),
  ]);

  return (
    <DashboardShell title="Support" email={email}>
      <SupportInbox initialChannels={channels} />
    </DashboardShell>
  );
}
