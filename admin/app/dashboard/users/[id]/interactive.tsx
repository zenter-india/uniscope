'use client';

import { useState, useTransition } from 'react';
import { getVerificationDocumentUrl, setUserBanned } from './actions';

export function BanToggle({
  userId,
  isBanned,
  disabled,
}: {
  userId: string;
  isBanned: boolean;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      try {
        await setUserBanned(userId, !isBanned);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update user');
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={isPending || disabled}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
          isBanned
            ? 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        {isBanned ? 'Unban user' : 'Ban user'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function VerificationDocButton({ requestId }: { requestId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const view = () => {
    setError(null);
    startTransition(async () => {
      try {
        setUrl(await getVerificationDocumentUrl(requestId));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load document');
      }
    });
  };

  return (
    <div>
      <button
        onClick={view}
        disabled={isPending}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
      >
        View document
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block overflow-hidden rounded-lg border border-zinc-200"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Verification document"
            className="max-h-72 w-full object-contain"
          />
        </a>
      )}
    </div>
  );
}
