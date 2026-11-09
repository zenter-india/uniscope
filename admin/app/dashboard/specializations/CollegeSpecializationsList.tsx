'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { InfiniteList } from '../../../components/InfiniteList';
import { Badge, Button, Card, fieldClass } from '../../../components/ui';
import { toast } from '../../../lib/toast';
import {
  loadSuggestions,
  reviewSuggestion,
  type SpecializationSuggestion,
  type SuggestionStatus,
} from './actions';

const STATUS_TONE: Record<SuggestionStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export function CollegeSpecializationsList({
  status,
  initialItems,
  initialCursor,
}: {
  status: SuggestionStatus;
  initialItems: SpecializationSuggestion[];
  initialCursor: string | null;
}) {
  return (
    <InfiniteList
      autoLoad
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadSuggestions(status, cursor)}
      renderItem={(s) => <SuggestionCard key={s.id} suggestion={s} />}
      emptyText={`No ${STATUS_LABEL[status].toLowerCase()} suggestions.`}
      emptyIcon="building"
    />
  );
}

function SuggestionCard({ suggestion }: { suggestion: SpecializationSuggestion }) {
  const [row, setRow] = useState(suggestion);
  const [name, setName] = useState(suggestion.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const college = row.university;
  const where = [college.city, college.state].filter(Boolean).join(', ');
  const willPublish = !college.isActive;

  const apply = (status: SuggestionStatus) => {
    setError(null);
    startTransition(async () => {
      const trimmed = name.trim();
      const res = await reviewSuggestion(
        row.id,
        status,
        trimmed && trimmed !== row.name ? trimmed : undefined,
      );
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setRow(res.suggestion);
      setName(res.suggestion.name);
      toast.success(
        status === 'APPROVED'
          ? `"${res.suggestion.name}" added to ${res.suggestion.university.name}'s list${
              res.suggestion.collegeActivated ? ' — and the college is now published' : ''
            }.`
          : status === 'REJECTED'
            ? `"${res.suggestion.name}" rejected.`
            : `"${res.suggestion.name}" moved back to pending.`,
      );
    });
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
        <Badge>{row.degree}</Badge>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          entered by {row.submissionCount} mentor{row.submissionCount === 1 ? '' : 's'}
        </span>
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
          first seen {new Date(row.createdAt).toLocaleDateString()}
          {row.reviewedAt ? ` · reviewed ${new Date(row.reviewedAt).toLocaleDateString()}` : ''}
        </span>
      </div>

      <div className="mt-3">
        <Link
          href={`/dashboard/universities?search=${encodeURIComponent(college.name)}`}
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          {college.name}
        </Link>
        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">{where}</span>
        {willPublish && (
          <span className="ml-2 inline-block align-middle">
            <Badge tone="info">New college · not published yet</Badge>
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          aria-label="Specialization name shown to users"
          className={`${fieldClass} sm:max-w-md`}
        />
        <div className="flex flex-wrap gap-2">
          {row.status !== 'APPROVED' && (
            <Button
              size="sm"
              variant="successSolid"
              onClick={() => apply('APPROVED')}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : willPublish ? 'Approve & publish college' : 'Approve'}
            </Button>
          )}
          {row.status === 'APPROVED' && name.trim() !== row.name && (
            <Button size="sm" variant="primary" onClick={() => apply('APPROVED')} disabled={isPending}>
              Save new name
            </Button>
          )}
          {row.status !== 'REJECTED' && (
            <Button size="sm" variant="danger" onClick={() => apply('REJECTED')} disabled={isPending}>
              Reject
            </Button>
          )}
          {row.status !== 'PENDING' && (
            <Button size="sm" onClick={() => apply('PENDING')} disabled={isPending}>
              Back to pending
            </Button>
          )}
        </div>
      </div>
      {willPublish && row.status === 'PENDING' && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Approving also makes this college visible in the app. If it is just a different
          spelling of a college that already exists, merge it under Universities instead.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </Card>
  );
}
