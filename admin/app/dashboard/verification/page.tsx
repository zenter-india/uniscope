import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { DashboardShell } from '../DashboardShell';
import { VerificationRow } from './VerificationRow';

interface VerificationRequestRow {
  id: string;
  userId: string;
  userDisplayName?: string;
  universityId: string;
  universityName?: string;
  documentType: string;
  status: string;
  submittedAt: string | null;
}

export default async function VerificationQueuePage() {
  const [email, queue] = await Promise.all([
    getAdminEmail(),
    backendFetch<VerificationRequestRow[]>('/verification/queue').catch(() => []),
  ]);

  return (
    <DashboardShell title="Verification Queue" email={email}>
      {queue.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No pending verification requests. New submissions show up here in
          FIFO order.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {queue.map((request) => (
            <VerificationRow key={request.id} request={request} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
