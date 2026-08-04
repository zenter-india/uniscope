'use client';

import { useState, useTransition } from 'react';
import { setUserBanned } from './actions';

interface UserRowData {
  id: string;
  displayName: string;
  role: string;
  verificationStatus: string;
  isBanned: boolean;
  isActive: boolean;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  VERIFIED: 'bg-emerald-100 text-emerald-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
  DRAFT: 'bg-zinc-100 text-zinc-600',
};

export function UserRow({ user }: { user: UserRowData }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleBan = () => {
    setError(null);
    startTransition(async () => {
      try {
        await setUserBanned(user.id, !user.isBanned);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update user');
      }
    });
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-zinc-900">{user.displayName}</p>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {user.role}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              STATUS_COLORS[user.verificationStatus] ?? 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {user.verificationStatus}
          </span>
          {user.isBanned && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Banned
            </span>
          )}
          {!user.isActive && !user.isBanned && (
            <span
              className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600"
              title="Self-deleted their account — reactivates automatically if they log in again"
            >
              Deleted
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-400">
          Joined {new Date(user.createdAt).toLocaleDateString()}
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <button
        onClick={toggleBan}
        disabled={isPending}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
          user.isBanned
            ? 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        {user.isBanned ? 'Unban' : 'Ban'}
      </button>
    </div>
  );
}
