import { backendFetch } from '../../../lib/backend';
import { getAdminEmail } from '../../../lib/adminAuth';
import { Table } from '../../../components/ui';
import { DashboardShell } from '../DashboardShell';
import { VerificationRow, type VerificationRequestRow } from './VerificationRow';

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
        <Table
          head={
            <tr>
              <Table.HeadCell>Applicant</Table.HeadCell>
              <Table.HeadCell>Role</Table.HeadCell>
              <Table.HeadCell>College · document</Table.HeadCell>
              <Table.HeadCell>Submitted</Table.HeadCell>
              <Table.HeadCell className="w-8" />
            </tr>
          }
        >
          {queue.map((request) => (
            <VerificationRow key={request.id} request={request} />
          ))}
        </Table>
      )}
    </DashboardShell>
  );
}
