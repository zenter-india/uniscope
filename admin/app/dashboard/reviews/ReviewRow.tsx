'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Badge, Button, Table, toneFor } from '../../../components/ui';
import { setReviewStatus, type ModeratedReview } from './actions';

function stars(n: number): string {
  const r = Math.max(0, Math.min(5, Math.round(n)));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

export function ReviewRow({ review }: { review: ModeratedReview }) {
  const [status, setStatus] = useState(review.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const move = (next: ModeratedReview['status']) => {
    setError(null);
    startTransition(async () => {
      const res = await setReviewStatus(review.kind, review.id, next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStatus(next);
    });
  };

  const subjectHref =
    review.kind === 'mentor'
      ? `/dashboard/users/${review.subjectId}`
      : `/dashboard/universities?search=${encodeURIComponent(review.subjectName)}`;

  return (
    <Table.Row>
      <Table.Cell className="whitespace-nowrap align-top">
        <span className="text-amber-500" title={`${review.rating} / 5`}>
          {stars(review.rating)}
        </span>
        <div className="mt-1">
          <Badge>{review.kind === 'mentor' ? 'Mentor' : 'College'}</Badge>
        </div>
      </Table.Cell>
      <Table.Cell className="align-top">
        <p className="max-w-md text-zinc-800">{review.text || <span className="text-zinc-400">— no text —</span>}</p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </Table.Cell>
      <Table.Cell className="align-top text-xs text-zinc-500">
        <p>
          by{' '}
          <Link
            href={`/dashboard/users/${review.authorId}`}
            className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
          >
            {review.authorName}
          </Link>
        </p>
        <p className="mt-0.5">
          for{' '}
          <Link
            href={subjectHref}
            className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
          >
            {review.subjectName}
          </Link>
        </p>
        <p className="mt-0.5 text-zinc-400">{new Date(review.createdAt).toLocaleDateString()}</p>
      </Table.Cell>
      <Table.Cell className="align-top">
        <Badge tone={toneFor(status)}>{status}</Badge>
      </Table.Cell>
      <Table.Cell className="align-top">
        <div className="flex flex-wrap justify-end gap-2">
          {status !== 'ACTIVE' && (
            <Button size="sm" onClick={() => move('ACTIVE')} disabled={isPending}>
              Restore
            </Button>
          )}
          {status !== 'HIDDEN' && status !== 'REMOVED' && (
            <Button
              size="sm"
              onClick={() => move('HIDDEN')}
              disabled={isPending}
              className="border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              Hide
            </Button>
          )}
          {status !== 'REMOVED' && (
            <Button size="sm" variant="danger" onClick={() => move('REMOVED')} disabled={isPending}>
              Remove
            </Button>
          )}
        </div>
      </Table.Cell>
    </Table.Row>
  );
}
