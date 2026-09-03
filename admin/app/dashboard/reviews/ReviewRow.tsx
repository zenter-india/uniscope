'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Badge, Button, Card, toneFor } from '../../../components/ui';
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
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-amber-500" title={`${review.rating} / 5`}>
              {stars(review.rating)}
            </span>
            <Badge tone={toneFor(status)}>{status}</Badge>
            <Badge>{review.kind === 'mentor' ? 'Mentor' : 'College'}</Badge>
          </div>
          {review.text && (
            <p className="mt-2 text-sm text-zinc-800">{review.text}</p>
          )}
          <p className="mt-2 text-xs text-zinc-400">
            by{' '}
            <Link
              href={`/dashboard/users/${review.authorId}`}
              className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
            >
              {review.authorName}
            </Link>{' '}
            · for{' '}
            <Link
              href={subjectHref}
              className="underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-600"
            >
              {review.subjectName}
            </Link>{' '}
            · {new Date(review.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
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
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}
