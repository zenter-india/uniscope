import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { PromotionPanel } from './PromotionPanel';
import { listPromotions, type Promotion } from './actions';

export default async function PromotionsPage() {
  const [email, history] = await Promise.all([
    getAdminEmail(),
    listPromotions().catch(() => [] as Promotion[]),
  ]);

  return (
    <DashboardShell title="Promotions" email={email}>
      <PromotionPanel initialHistory={history} />
    </DashboardShell>
  );
}
