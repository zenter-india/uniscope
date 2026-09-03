'use client';

import { useState, useTransition } from 'react';
import { Button } from '../../../../components/ui';
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
      <Button
        onClick={toggle}
        disabled={isPending || disabled}
        size="sm"
        variant={isBanned ? 'secondary' : 'dangerSolid'}
      >
        {isBanned ? 'Unban user' : 'Ban user'}
      </Button>
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
      <Button onClick={view} disabled={isPending} size="sm">
        View document
      </Button>
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
