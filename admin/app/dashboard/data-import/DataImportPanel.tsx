'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { applyJob, getJob, runImport, type DataImportJob, type DiffItem } from './actions';

const TYPE_LABEL: Record<'UG' | 'PG', string> = {
  UG: 'Undergraduate (MBBS)',
  PG: 'Postgraduate',
};

const TYPE_SOURCE: Record<'UG' | 'PG', string> = {
  UG: "NMC's official MBBS seat-matrix PDF + NIRF medical rankings",
  PG: "MCC's official PG participating-institute tool",
};

function StatusPill({ status }: { status: DataImportJob['status'] }) {
  const styles: Record<DataImportJob['status'], string> = {
    RUNNING: 'bg-amber-100 text-amber-700',
    COMPLETED: 'bg-blue-100 text-blue-700',
    FAILED: 'bg-red-100 text-red-700',
    APPLIED: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
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
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-2">
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
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    item.confidence === 'high'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {item.confidence === 'high' ? 'high confidence' : 'needs review'}
                </span>
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

function JobCard({ job: initialJob }: { job: DataImportJob }) {
  const [job, setJob] = useState(initialJob);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [seeded, setSeeded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const apply = () => {
    startTransition(async () => {
      const updated = await applyJob(job.id, Array.from(selected));
      setJob(updated);
    });
  };

  const diff = job.diffJson;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-zinc-900">{TYPE_LABEL[job.type]}</span>
          <span className="ml-2 text-xs text-zinc-400">
            started {new Date(job.startedAt).toLocaleString()}
          </span>
        </div>
        <StatusPill status={job.status} />
      </div>

      {job.status === 'RUNNING' && (
        <p className="mt-2 text-sm text-zinc-500">
          Capturing from {TYPE_SOURCE[job.type]}… this can take up to a minute.
        </p>
      )}

      {job.status === 'FAILED' && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{job.error}</p>
      )}

      {job.status === 'APPLIED' && (
        <p className="mt-2 text-sm text-zinc-500">
          Applied {job.appliedJson?.addedKeys.length ?? 0} new/changed rows on{' '}
          {job.appliedAt ? new Date(job.appliedAt).toLocaleString() : ''}.
        </p>
      )}

      {diff && job.status === 'COMPLETED' && (
        <>
          <p className="mt-2 text-sm text-zinc-600">
            {diff.sourceCount} captured · {diff.unchanged} already match · {diff.added.length}{' '}
            new · {diff.changed.length} changed. Nothing below is written until you review and
            click Apply.
          </p>
          <DiffSection title="New colleges" items={diff.added} selected={selected} onToggle={toggle} />
          <DiffSection title="Changed fields" items={diff.changed} selected={selected} onToggle={toggle} />

          {diff.added.length + diff.changed.length > 0 && (
            <button
              onClick={apply}
              disabled={isPending || selected.size === 0}
              className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? 'Applying…' : `Apply ${selected.size} selected`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function DataImportPanel({ initialJobs }: { initialJobs: DataImportJob[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [isPending, startTransition] = useTransition();

  const start = (type: 'UG' | 'PG') => {
    startTransition(async () => {
      const job = await runImport(type);
      setJobs((prev) => [job, ...prev]);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="mb-1 text-sm font-semibold text-zinc-900">Refresh college data</p>
        <p className="mb-3 text-xs text-zinc-500">
          Re-runs the same capture pipeline the dataset was originally seeded from and shows a
          diff to review before anything is written. See backend/scripts/data/README.md.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => start('UG')}
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Refresh UG data
          </button>
          <button
            onClick={() => start('PG')}
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            Refresh PG data
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <p className="text-sm text-zinc-500">No import runs yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
