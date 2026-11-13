'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card } from '../../../components/ui';
import { toast } from '../../../lib/toast';
import { saveUserPermissions, type UserPermissions } from './actions';

const REASON_MAX = 300;

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Checked = allowed. Unchecking a box revokes that permission for the user
 * once Save is pressed; everything is allowed by default. A reason is needed
 * whenever something is newly denied, and every change is kept in the history. */
export function PermissionsPanel({ initial }: { initial: UserPermissions }) {
  const [saved, setSaved] = useState(initial);
  const [allowed, setAllowed] = useState<Record<string, boolean>>(
    Object.fromEntries(initial.permissions.map((p) => [p.key, p.allowed])),
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = saved.permissions.some((p) => allowed[p.key] !== p.allowed);
  const newlyDenied = saved.permissions.some((p) => p.allowed && !allowed[p.key]);
  const reasonOk = !newlyDenied || reason.trim().length >= 3;

  const setAll = (value: boolean) =>
    setAllowed(Object.fromEntries(saved.permissions.map((p) => [p.key, value])));

  const save = () => {
    setError(null);
    const denied = saved.permissions.filter((p) => !allowed[p.key]).map((p) => p.key);
    startTransition(async () => {
      const res = await saveUserPermissions(saved.user.id, denied, reason);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setSaved(res.data);
      setAllowed(Object.fromEntries(res.data.permissions.map((p) => [p.key, p.allowed])));
      setReason('');
      toast.success('Permissions saved.');
    });
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {saved.user.displayName}
        </h2>
        <Badge>{saved.user.role}</Badge>
        {saved.user.uniqueId && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{saved.user.uniqueId}</span>
        )}
      </div>

      <div className="mb-2 flex gap-2">
        <Button variant="secondary" size="sm" type="button" onClick={() => setAll(true)}>
          Allow all
        </Button>
        <Button variant="secondary" size="sm" type="button" onClick={() => setAll(false)}>
          Deny all
        </Button>
      </div>

      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {saved.permissions.map((p) => (
          <li key={p.key}>
            <label className="flex cursor-pointer items-start gap-3 py-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
                checked={allowed[p.key] ?? true}
                onChange={(e) => setAllowed((a) => ({ ...a, [p.key]: e.target.checked }))}
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {p.label}
                </span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">{p.description}</span>
                {!p.allowed && p.deniedAt && (
                  <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                    Denied {fmt(p.deniedAt)}
                    {p.deniedBy ? ` by ${p.deniedBy}` : ''}
                    {p.reason ? ` — ${p.reason}` : ''}
                  </span>
                )}
              </span>
              {!(allowed[p.key] ?? true) && <Badge tone="danger">Denied</Badge>}
            </label>
          </li>
        ))}
      </ul>

      {newlyDenied && (
        <div className="mt-4">
          <label
            htmlFor="perm-reason"
            className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Reason for denying
          </label>
          <textarea
            id="perm-reason"
            value={reason}
            maxLength={REASON_MAX}
            rows={2}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Reported for spam by 3 users"
            className="w-full rounded-md border border-zinc-300 bg-transparent p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Saved with your email and the time. {reason.length}/{REASON_MAX}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={!dirty || !reasonOk || isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>

      {saved.history.length > 0 && (
        <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">History</h3>
          <ul className="space-y-2">
            {saved.history.map((h, i) => (
              <li key={`${h.at}-${h.permission}-${i}`} className="text-xs text-zinc-600 dark:text-zinc-400">
                <Badge tone={h.action === 'DENY' ? 'danger' : 'success'}>
                  {h.action === 'DENY' ? 'Denied' : 'Allowed'}
                </Badge>{' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{h.label}</span> ·{' '}
                {fmt(h.at)}
                {h.adminEmail ? ` · ${h.adminEmail}` : ''}
                {h.reason ? ` — ${h.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
