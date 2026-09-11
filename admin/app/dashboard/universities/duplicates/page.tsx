import Link from 'next/link';
import { getAdminEmail } from '../../../../lib/adminAuth';
import { DashboardShell } from '../../DashboardShell';
import { loadDuplicateGroups } from '../actions';
import { DuplicatesList } from './DuplicatesList';

export default async function UniversityDuplicatesPage() {
  const [email, groups] = await Promise.all([
    getAdminEmail(),
    loadDuplicateGroups().catch(() => []),
  ]);

  return (
    <DashboardShell title="Merge duplicates" email={email}>
      <Link
        href="/dashboard/universities"
        className="mb-4 inline-block text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100"
      >
        ← Back to universities
      </Link>
      <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        Active colleges sharing the same name and state — almost always the same real
        college imported twice. Pick which row survives; everything else (programs,
        reviews, saved colleges, mentor verifications, linked profiles) is moved onto
        it and the rest are deactivated. Never a row delete — a merged-away college can
        still be found (inactive) in the main list.
      </p>
      <DuplicatesList initialGroups={groups} />
    </DashboardShell>
  );
}
