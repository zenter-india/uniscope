'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, ButtonLink, Table, toneFor } from '../../../components/ui';
import { ConfirmButton } from '../../../components/ConfirmButton';
import { toast } from '../../../lib/toast';
import { setUserBanned } from './actions';

export interface UserRowData {
  id: string;
  displayName: string;
  role: string;
  verificationStatus: string;
  isBanned: boolean;
  isActive: boolean;
  createdAt: string;
}

export function UserRow({ user }: { user: UserRowData }) {
  const [error, setError] = useState<string | null>(null);
  // Tracked locally: the list keeps rows in client state, so a server
  // revalidate after a ban toggle doesn't re-flow fresh props into this row.
  const [isBanned, setIsBanned] = useState(user.isBanned);
  const [isPending, startTransition] = useTransition();

  const toggleBan = () => {
    setError(null);
    startTransition(async () => {
      try {
        await setUserBanned(user.id, !isBanned);
        setIsBanned((v) => !v);
        toast.success(isBanned ? 'User unbanned.' : 'User banned.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not update user';
        setError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <Table.Row>
      <Table.Cell>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{user.displayName}</span>
          {isBanned && <Badge tone="danger">Banned</Badge>}
          {!user.isActive && !isBanned && (
            <span title="Self-deleted their account — reactivates automatically if they log in again">
              <Badge>Deleted</Badge>
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </Table.Cell>
      <Table.Cell>
        <Badge>{user.role}</Badge>
      </Table.Cell>
      <Table.Cell>
        <Badge tone={toneFor(user.verificationStatus)}>{user.verificationStatus}</Badge>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        {new Date(user.createdAt).toLocaleDateString()}
      </Table.Cell>
      <Table.Cell>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <ButtonLink href={`/dashboard/users/${user.id}`} size="sm">
            View details
          </ButtonLink>
          {isBanned ? (
            <Button onClick={toggleBan} disabled={isPending} size="sm" variant="secondary">
              Unban
            </Button>
          ) : (
            <ConfirmButton onConfirm={toggleBan} disabled={isPending}>
              Ban
            </ConfirmButton>
          )}
        </div>
      </Table.Cell>
    </Table.Row>
  );
}
