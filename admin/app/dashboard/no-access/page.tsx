import Link from 'next/link';
import { getAdminEmail } from '../../../lib/adminAuth';
import { getAccess } from '../../../lib/access';
import { ADMIN_SECTIONS, canView, sectionForPath } from '../../../lib/permissions';
import { EmptyState } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; reason?: string }>;
}) {
  const { from = '', reason } = await searchParams;
  const [email, access] = await Promise.all([getAdminEmail(), getAccess()]);
  const section = sectionForPath(from);
  const firstOpen = ADMIN_SECTIONS.find((s) => canView(access, s.key));

  const message =
    reason === 'unavailable'
      ? 'Could not check your permissions right now. Please try again in a moment.'
      : section
        ? `You don't have access to ${section.label}. Ask an admin who manages the Admins page to give you access.`
        : "You don't have access to this page. Ask an admin who manages the Admins page to give you access.";

  return (
    <DashboardShell title="No access" email={email}>
      <EmptyState icon="lock">
        <p>{message}</p>
        {firstOpen && (
          <p className="mt-3">
            <Link href={firstOpen.path} className="underline">
              Go to {firstOpen.label}
            </Link>
          </p>
        )}
      </EmptyState>
    </DashboardShell>
  );
}
