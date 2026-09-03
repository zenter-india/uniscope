'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, ButtonLink, Card, toneFor } from '../../../components/ui';
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update user');
      }
    });
  };

  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-medium text-zinc-900">{user.displayName}</p>
          <Badge>{user.role}</Badge>
          <Badge tone={toneFor(user.verificationStatus)}>{user.verificationStatus}</Badge>
          {isBanned && <Badge tone="danger">Banned</Badge>}
          {!user.isActive && !isBanned && (
            <span title="Self-deleted their account — reactivates automatically if they log in again">
              <Badge>Deleted</Badge>
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Joined {new Date(user.createdAt).toLocaleDateString()}
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ButtonLink href={`/dashboard/users/${user.id}`} size="sm">
          View details
        </ButtonLink>
        <Button
          onClick={toggleBan}
          disabled={isPending}
          size="sm"
          variant={isBanned ? 'secondary' : 'dangerSolid'}
        >
          {isBanned ? 'Unban' : 'Ban'}
        </Button>
      </div>
    </Card>
  );
}
