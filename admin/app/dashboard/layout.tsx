import { AccessProvider } from '../../components/AccessContext';
import { getAccess } from '../../lib/access';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess();
  return <AccessProvider access={access}>{children}</AccessProvider>;
}
