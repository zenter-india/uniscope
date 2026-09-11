import { Badge, Table, toneFor } from '../../../components/ui';
import type { VerificationHistoryRowData } from './actions';

function fmt(v: string | null): string {
  return v ? new Date(v).toLocaleString() : '—';
}

export function VerificationHistoryRow({ request }: { request: VerificationHistoryRowData }) {
  return (
    <Table.Row>
      <Table.Cell>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {request.userDisplayName ?? request.userId}
        </span>
        {request.userRole && <Badge className="ml-2">{request.userRole}</Badge>}
      </Table.Cell>
      <Table.Cell className="text-xs text-zinc-500 dark:text-zinc-400">
        {request.universityName ?? request.universityId}
      </Table.Cell>
      <Table.Cell>
        <Badge tone={toneFor(request.status)}>{request.status}</Badge>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
        {fmt(request.reviewedAt)}
      </Table.Cell>
      <Table.Cell className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">
        {request.reviewNote || <span className="text-zinc-300 dark:text-zinc-600">—</span>}
      </Table.Cell>
    </Table.Row>
  );
}
