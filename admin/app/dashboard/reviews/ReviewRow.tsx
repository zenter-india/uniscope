'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { setReviewStatus, type ModeratedReview } from './actions';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  HIDDEN: 'bg-amber-100 text-amber-700',
  REMOVED: 'bg-red-100 text-red-700',
};

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
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-amber-500" title={`${review.rating} / 5`}>
              {stars(review.rating)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {status}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {review.kind === 'mentor' ? 'Mentor' : 'College'}
            </span>
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

        <div className="flex flex-wrap gap-2">
          {status !== 'ACTIVE' && (
            <button
              onClick={() => move('ACTIVE')}
              disabled={isPending}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Restore
            </button>
          )}
          {status !== 'HIDDEN' && status !== 'REMOVED' && (
            <button
              onClick={() => move('HIDDEN')}
              disabled={isPending}
              className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              Hide
            </button>
          )}
          {status !== 'REMOVED' && (
            <button
              onClick={() => move('REMOVED')}
              disabled={isPending}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
