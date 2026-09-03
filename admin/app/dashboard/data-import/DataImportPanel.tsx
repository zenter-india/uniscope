'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Badge, Button, Card, fieldClass } from '../../../components/ui';
import { applyJob, getJob, runImport, type DataImportJob, type DiffItem } from './actions';

const TYPE_LABEL: Record<'UG' | 'PG', string> = {
  UG: 'Undergraduate (MBBS)',
  PG: 'Postgraduate',
};

const TYPE_SOURCE: Record<'UG' | 'PG', string> = {
  UG: "NMC's official MBBS seat-matrix PDF + NIRF medical rankings",
  PG: "MCC's official PG participating-institute tool",
};

const STATUS_TONE: Record<
  DataImportJob['status'],
  'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  RUNNING: 'warning',
  COMPLETED: 'info',
  FAILED: 'danger',
  APPLIED: 'success',
};

function elapsed(fromIso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(fromIso).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function DiffSection({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: DiffItem[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title} ({items.length})
      </p>
      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2">
        {items.map((item) => (
          <label
            key={item.key}
            className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-50"
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selected.has(item.key)}
              onChange={() => onToggle(item.key)}
            />
            <span className="flex-1">
              <span className="font-medium text-zinc-900">{item.name}</span>
              {item.confidence && (
                <Badge
                  tone={item.confidence === 'high' ? 'success' : 'warning'}
                  className="ml-2 text-[10px]"
                >
                  {item.confidence === 'high' ? 'high confidence' : 'needs review'}
                </Badge>
              )}
              <br />
              <span className="text-xs text-zinc-500">{item.detail}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function JobCard({
  job: initialJob,
  onRetry,
}: {
  job: DataImportJob;
  onRetry: (type: 'UG' | 'PG') => void;
}) {
  const [job, setJob] = useState(initialJob);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(false);
  const [filter, setFilter] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceTick] = useState(0);

  // `job` also gets locally mutated by polling below, so it can't just be
  // derived from `initialJob` every render — it needs to re-sync only when
  // the parent actually hands us a different job. Doing that during render
  // (rather than in an effect) is React's own recommended replacement for
  // "adjust state when a prop changes": https://react.dev/learn/you-might-not-need-an-effect
  const [prevInitialJob, setPrevInitialJob] = useState(initialJob);
  if (initialJob !== prevInitialJob) {
    setPrevInitialJob(initialJob);
    setJob(initialJob);
  }

  useEffect(() => {
    if (job.status !== 'RUNNING') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      const fresh = await getJob(job.id);
      setJob(fresh);
      forceTick((n) => n + 1); // keep the elapsed timer ticking
    }, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job.id, job.status]);

  // Pre-check sensible defaults once the diff arrives: every new/changed UG
  // row, but only high-confidence PG matches — a medium-confidence PG match
  // needs a human to actually read the MCC name before it's trusted (see
  // match_pg.py's docstring for why token-overlap alone isn't enough).
  // Same during-render pattern as above — this only ever needs to run once,
  // guarded by `seeded`, not on every render diffJson happens to be present.
  if (job.diffJson && !seeded) {
    const keys = new Set<string>();
    for (const item of job.diffJson.added) {
      if (item.confidence === undefined || item.confidence === 'high') keys.add(item.key);
    }
    for (const item of job.diffJson.changed) keys.add(item.key);
    setSelected(keys);
    setSeeded(true);
  }

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const diff = job.diffJson;
  const allItems = useMemo(
    () => (diff ? [...diff.added, ...diff.changed] : []),
    [diff],
  );

  const q = filter.trim().toLowerCase();
  const matches = (item: DiffItem) =>
    !q || item.name.toLowerCase().includes(q) || item.detail.toLowerCase().includes(q);
  const visibleAdded = (diff?.added ?? []).filter(matches);
  const visibleChanged = (diff?.changed ?? []).filter(matches);
  const visible = [...visibleAdded, ...visibleChanged];

  const selectKeys = (keys: string[]) => setSelected(new Set(keys));
  const selectAllVisible = () => selectKeys(visible.map((i) => i.key));
  const selectNone = () => selectKeys([]);
  const selectHighConfidence = () =>
    selectKeys(
      allItems
        .filter((i) => i.confidence === undefined || i.confidence === 'high')
        .map((i) => i.key),
    );

  const apply = () => {
    startTransition(async () => {
      const updated = await applyJob(job.id, Array.from(selected));
      setJob(updated);
      setConfirming(false);
    });
  };

  const selectedAdded = (diff?.added ?? []).filter((i) => selected.has(i.key)).length;
  const selectedChanged = (diff?.changed ?? []).filter((i) => selected.has(i.key)).length;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="font-medium text-zinc-900">{TYPE_LABEL[job.type]}</span>
          <span className="ml-2 text-xs text-zinc-400">
            started {new Date(job.startedAt).toLocaleString()}
          </span>
        </div>
        <Badge tone={STATUS_TONE[job.status]}>{job.status}</Badge>
      </div>

      {job.status === 'RUNNING' && (
        <p className="mt-2 text-sm text-zinc-500">
          Capturing from {TYPE_SOURCE[job.type]}… {elapsed(job.startedAt)} elapsed (usually
          under a minute).
        </p>
      )}

      {job.status === 'FAILED' && (
        <div className="mt-2">
          <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{job.error}</p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => onRetry(job.type)}
            disabled={isPending}
          >
            Retry {job.type} refresh
          </Button>
        </div>
      )}

      {job.status === 'APPLIED' && (
        <p className="mt-2 text-sm text-zinc-500">
          Applied {job.appliedJson?.addedKeys.length ?? 0} new and{' '}
          {job.appliedJson?.changedKeys.length ?? 0} changed rows on{' '}
          {job.appliedAt ? new Date(job.appliedAt).toLocaleString() : ''}.
        </p>
      )}

      {diff && job.status === 'COMPLETED' && (
        <>
          <p className="mt-2 text-sm text-zinc-600">
            {diff.sourceCount} captured · {diff.unchanged} already match · {diff.added.length}{' '}
            new · {diff.changed.length} changed. Nothing is written until you review and
            click Apply.
          </p>

          {diff.added.length + diff.changed.length > 0 && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by college name…"
                  className={`${fieldClass} h-8 w-56`}
                />
                <Button size="sm" variant="secondary" onClick={selectAllVisible}>
                  Select all{q ? ' shown' : ''}
                </Button>
                <Button size="sm" variant="secondary" onClick={selectNone}>
                  Select none
                </Button>
                {allItems.some((i) => i.confidence !== undefined) && (
                  <Button size="sm" variant="secondary" onClick={selectHighConfidence}>
                    High-confidence only
                  </Button>
                )}
                <span className="text-xs text-zinc-500">
                  {selected.size} selected
                  {q ? ` · ${visible.length} shown` : ''}
                </span>
              </div>

              <DiffSection
                title="New colleges"
                items={visibleAdded}
                selected={selected}
                onToggle={toggle}
              />
              <DiffSection
                title="Changed fields"
                items={visibleChanged}
                selected={selected}
                onToggle={toggle}
              />

              {confirming ? (
                <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm text-amber-900">
                    Write <span className="font-semibold">{selectedAdded} new</span> and{' '}
                    <span className="font-semibold">{selectedChanged} changed</span> rows to the
                    live college catalogue? Applied rows can only be reverted one at a time from
                    the Universities page.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="successSolid"
                      onClick={apply}
                      disabled={isPending}
                    >
                      {isPending ? 'Applying…' : 'Confirm & apply'}
                    </Button>
                    <Button size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  className="mt-3"
                  onClick={() => setConfirming(true)}
                  disabled={selected.size === 0}
                >
                  Apply {selected.size} selected
                </Button>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}

const VISIBLE_JOBS = 3;

export function DataImportPanel({ initialJobs }: { initialJobs: DataImportJob[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [showAll, setShowAll] = useState(false);
  const [isPending, startTransition] = useTransition();

  const start = (type: 'UG' | 'PG') => {
    startTransition(async () => {
      const job = await runImport(type);
      setJobs((prev) => [job, ...prev]);
      setShowAll(false);
    });
  };

  const shown = showAll ? jobs : jobs.slice(0, VISIBLE_JOBS);
  const hiddenCount = jobs.length - shown.length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <p className="text-sm font-semibold text-zinc-900">Refresh college data</p>
        <p className="mt-1 text-sm text-zinc-600">
          Re-runs the capture pipeline the ~10,500-college catalogue was originally built from
          and shows a diff to review. Run it when NMC or MCC publish new seat data — typically
          around the admission cycle. It is safe to run anytime: the capture step never writes
          to the database, and nothing changes until you review the diff and click Apply.
        </p>
        <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
          <li>
            <span className="font-medium text-zinc-600">UG (MBBS):</span> {TYPE_SOURCE.UG}
          </li>
          <li>
            <span className="font-medium text-zinc-600">PG:</span> {TYPE_SOURCE.PG}
          </li>
        </ul>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" size="sm" onClick={() => start('UG')} disabled={isPending}>
            Refresh UG (MBBS) data
          </Button>
          <Button variant="primary" size="sm" onClick={() => start('PG')} disabled={isPending}>
            Refresh PG data
          </Button>
        </div>
      </Card>

      {jobs.length === 0 ? (
        <p className="text-sm text-zinc-500">No import runs yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((job) => (
            <JobCard key={job.id} job={job} onRetry={start} />
          ))}
          {hiddenCount > 0 && !showAll && (
            <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>
              Show {hiddenCount} older run{hiddenCount > 1 ? 's' : ''}
            </Button>
          )}
          {showAll && jobs.length > VISIBLE_JOBS && (
            <Button size="sm" variant="ghost" onClick={() => setShowAll(false)}>
              Show fewer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
