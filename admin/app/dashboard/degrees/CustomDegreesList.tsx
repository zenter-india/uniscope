'use client';

import { useState, useTransition } from 'react';
import { InfiniteList } from '../../../components/InfiniteList';
import { Badge, Button, Card, fieldClass } from '../../../components/ui';
import { toast } from '../../../lib/toast';
import {
  loadCustomDegrees,
  reviewCustomDegree,
  type CustomDegree,
  type CustomDegreeStatus,
} from './actions';

const STATUS_TONE: Record<CustomDegreeStatus, 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const STATUS_LABEL: Record<CustomDegreeStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export function CustomDegreesList({
  status,
  initialItems,
  initialCursor,
}: {
  status: CustomDegreeStatus;
  initialItems: CustomDegree[];
  initialCursor: string | null;
}) {
  return (
    <InfiniteList
      autoLoad
      initialItems={initialItems}
      initialCursor={initialCursor}
      loadMore={(cursor) => loadCustomDegrees(status, cursor)}
      renderItem={(degree) => <DegreeCard key={degree.id} degree={degree} />}
      emptyText={`No ${STATUS_LABEL[status].toLowerCase()} degrees.`}
      emptyIcon="building"
    />
  );
}

function DegreeCard({ degree }: { degree: CustomDegree }) {
  const [row, setRow] = useState(degree);
  const [name, setName] = useState(degree.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const apply = (status: CustomDegreeStatus) => {
    setError(null);
    startTransition(async () => {
      const trimmed = name.trim();
      const res = await reviewCustomDegree(
        row.id,
        status,
        trimmed && trimmed !== row.name ? trimmed : undefined,
      );
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setRow(res.degree);
      setName(res.degree.name);
      toast.success(
        status === 'APPROVED'
          ? `"${res.degree.name}" approved — it will show for everyone next time.`
          : status === 'REJECTED'
            ? `"${res.degree.name}" rejected.`
            : `"${res.degree.name}" moved back to pending.`,
      );
    });
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
        <Badge>{row.stream}</Badge>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          typed {row.submissionCount} time{row.submissionCount === 1 ? '' : 's'}
        </span>
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
          first seen {new Date(row.createdAt).toLocaleDateString()}
          {row.reviewedAt ? ` · reviewed ${new Date(row.reviewedAt).toLocaleDateString()}` : ''}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          aria-label="Degree name shown to users"
          className={`${fieldClass} sm:max-w-sm`}
        />
        <div className="flex flex-wrap gap-2">
          {row.status !== 'APPROVED' && (
            <Button
              size="sm"
              variant="successSolid"
              onClick={() => apply('APPROVED')}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Approve'}
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
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </Card>
  );
}
