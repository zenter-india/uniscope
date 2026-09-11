'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card } from '../../../components/ui';
import {
  listTechnicalReports,
  setTechnicalReportStatus,
  type TechnicalReport,
} from './actions';

type Filter = 'OPEN' | 'RESOLVED' | 'ALL';

export function TechnicalReportsList({
  initialReports,
}: {
  initialReports: TechnicalReport[];
}) {
  const [reports, setReports] = useState(initialReports);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [busy, startBusy] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const reload = (f: Filter) => {
    setFilter(f);
    startBusy(async () => {
      try {
        const res = await listTechnicalReports(f === 'ALL' ? undefined : f);
        setReports(res.data);
        setErr(null);
      } catch {
        setErr('Could not refresh the list.');
      }
    });
  };

  const shown =
    filter === 'ALL' ? reports : reports.filter((r) => r.status === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        {(['ALL', 'OPEN', 'RESOLVED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => reload(f)}
            disabled={busy}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                : 'border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'OPEN' ? 'Open' : 'Resolved'}
          </button>
        ))}
        <button
          onClick={() => reload(filter)}
          disabled={busy}
          className="ml-auto text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-40"
        >
          Refresh
        </button>
      </div>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      {shown.length === 0 ? (
        <Card className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
          No technical reports{filter !== 'ALL' ? ` (${filter.toLowerCase()})` : ''} yet.
        </Card>
      ) : (
        shown.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            onChanged={(updated) =>
              setReports((prev) =>
                prev.map((p) => (p.id === updated.id ? updated : p)),
              )
            }
          />
        ))
      )}
    </div>
  );
}

function ReportCard({
  report,
  onChanged,
}: {
  report: TechnicalReport;
  onChanged: (r: TechnicalReport) => void;
}) {
  const [note, setNote] = useState(report.adminNote ?? '');
  const [saving, startSaving] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const apply = (status: 'OPEN' | 'RESOLVED') => {
    setErr(null);
    startSaving(async () => {
      const res = await setTechnicalReportStatus(report.id, status, note.trim());
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      onChanged(res.report);
    });
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={report.status === 'OPEN' ? 'warning' : 'success'}>
          {report.status === 'OPEN' ? 'Open' : 'Resolved'}
        </Badge>
        {report.reporter && (
          <>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {report.reporter.displayName}
            </span>
            <Badge tone={report.reporter.role === 'MENTOR' ? 'success' : 'neutral'}>
              {report.reporter.role === 'MENTOR' ? 'Mentor' : 'Student'}
            </Badge>
            {report.reporter.uniqueId && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {report.reporter.uniqueId}
              </span>
            )}
          </>
        )}
        <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
          {report.platform ? `${report.platform} · ` : ''}
          {report.appVersion ? `v${report.appVersion} · ` : ''}
          {new Date(report.createdAt).toLocaleString()}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-100">
        {report.message}
      </p>

      <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Internal note (optional)"
          className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
        />
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <div className="flex gap-2">
          {report.status === 'OPEN' ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => apply('RESOLVED')}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Mark resolved'}
            </Button>
          ) : (
            <Button size="sm" onClick={() => apply('OPEN')} disabled={saving}>
              {saving ? 'Saving…' : 'Reopen'}
            </Button>
          )}
          {report.status === 'OPEN' && note.trim() !== (report.adminNote ?? '') && (
            <Button size="sm" onClick={() => apply('OPEN')} disabled={saving}>
              Save note
            </Button>
          )}
        </div>
        {report.resolvedAt && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Resolved {new Date(report.resolvedAt).toLocaleString()}
          </span>
        )}
      </div>
    </Card>
  );
}
