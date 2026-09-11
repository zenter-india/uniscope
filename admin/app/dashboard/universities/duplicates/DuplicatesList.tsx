'use client';

import { useState, useTransition } from 'react';
import { Badge, Card, EmptyState } from '../../../../components/ui';
import { ConfirmButton } from '../../../../components/ConfirmButton';
import { toast } from '../../../../lib/toast';
import { mergeUniversities, type DuplicateGroup, type DuplicateUniversity } from '../actions';

function groupId(g: DuplicateGroup): string {
  return `${g.key}|${g.state}`;
}

function summarize(counts: {
  programsMoved: number;
  reviewsMoved: number;
  savedMoved: number;
  profilesMoved: number;
  verificationRequestsMoved: number;
  enrollmentLeadsMoved: number;
}): string {
  const parts = [
    counts.programsMoved && `${counts.programsMoved} program${counts.programsMoved === 1 ? '' : 's'}`,
    counts.reviewsMoved && `${counts.reviewsMoved} review${counts.reviewsMoved === 1 ? '' : 's'}`,
    counts.savedMoved && `${counts.savedMoved} saved`,
    counts.profilesMoved && `${counts.profilesMoved} profile${counts.profilesMoved === 1 ? '' : 's'}`,
    counts.verificationRequestsMoved &&
      `${counts.verificationRequestsMoved} verification${counts.verificationRequestsMoved === 1 ? '' : 's'}`,
    counts.enrollmentLeadsMoved && `${counts.enrollmentLeadsMoved} lead${counts.enrollmentLeadsMoved === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') + ' moved.' : 'Nothing to move — just deactivated the duplicate.';
}

function GroupCard({
  group,
  onMerged,
}: {
  group: DuplicateGroup;
  onMerged: (id: string) => void;
}) {
  const [winnerId, setWinnerId] = useState(group.universities[0]?.id);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loserCount = group.universities.length - 1;

  const merge = () => {
    setError(null);
    const loserIds = group.universities.filter((u) => u.id !== winnerId).map((u) => u.id);
    startTransition(async () => {
      const res = await mergeUniversities(winnerId, loserIds);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(`Merged ${loserCount} duplicate${loserCount === 1 ? '' : 's'}. ${summarize(res.result)}`);
      onMerged(groupId(group));
    });
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {group.universities[0]?.name}
        </h3>
        <Badge tone="warning">{group.universities.length} duplicates</Badge>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{group.state}</span>
      </div>

      <div role="radiogroup" aria-label="Pick which row survives" className="flex flex-col gap-2">
        {group.universities.map((u: DuplicateUniversity) => (
          <label
            key={u.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
              winnerId === u.id
                ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60'
                : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
            }`}
          >
            <input
              type="radio"
              name={`winner-${groupId(group)}`}
              checked={winnerId === u.id}
              onChange={() => setWinnerId(u.id)}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {[u.city, u.state].filter(Boolean).join(', ')}
                </span>
                {winnerId === u.id && <Badge tone="success">Keep this one</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {u.stream ?? 'no stream'} · {u.programCount} program{u.programCount === 1 ? '' : 's'} ·{' '}
                {u.reviewCount} review{u.reviewCount === 1 ? '' : 's'} · added{' '}
                {new Date(u.createdAt).toLocaleDateString()}
              </p>
            </div>
          </label>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3">
        <ConfirmButton
          variant="dangerSolid"
          size="sm"
          confirmLabel={`Merge ${loserCount} into the picked row?`}
          onConfirm={merge}
          disabled={isPending || !winnerId}
        >
          {isPending ? 'Merging…' : `Merge ${loserCount} duplicate${loserCount === 1 ? '' : 's'}`}
        </ConfirmButton>
      </div>
    </Card>
  );
}

export function DuplicatesList({ initialGroups }: { initialGroups: DuplicateGroup[] }) {
  const [groups, setGroups] = useState(initialGroups);

  if (groups.length === 0) {
    return (
      <EmptyState icon="building">
        No likely duplicates found — every active college has a unique name+state pair.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <GroupCard
          key={groupId(g)}
          group={g}
          onMerged={(id) => setGroups((prev) => prev.filter((x) => groupId(x) !== id))}
        />
      ))}
    </div>
  );
}
