import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { SupportView } from './SupportView';
import {
  listSupportChannels,
  listTechnicalReports,
  type SupportChannelSummary,
  type TechnicalReport,
} from './actions';

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const [email, channels, technical] = await Promise.all([
    getAdminEmail(),
    listSupportChannels().catch(() => [] as SupportChannelSummary[]),
    listTechnicalReports()
      .then((r) => r.data)
      .catch(() => [] as TechnicalReport[]),
  ]);

  return (
    <DashboardShell title="Support" email={email}>
      <SupportView channels={channels} technicalReports={technical} />
    </DashboardShell>
  );
}
