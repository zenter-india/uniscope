'use client';

import { useState, useTransition } from 'react';
import { Badge, Button, Card } from '../../../components/ui';
import { toast } from '../../../lib/toast';
import { saveUserPermissions, type UserPermissions } from './actions';

/** Checked = allowed. Unchecking a box revokes that permission for the user
 * once Save is pressed; everything is allowed by default. */
export function PermissionsPanel({ initial }: { initial: UserPermissions }) {
  const [saved, setSaved] = useState(initial);
  const [allowed, setAllowed] = useState<Record<string, boolean>>(
    Object.fromEntries(initial.permissions.map((p) => [p.key, p.allowed])),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = saved.permissions.some((p) => allowed[p.key] !== p.allowed);

  const setAll = (value: boolean) =>
    setAllowed(Object.fromEntries(saved.permissions.map((p) => [p.key, value])));

  const save = () => {
    setError(null);
    const denied = saved.permissions.filter((p) => !allowed[p.key]).map((p) => p.key);
    startTransition(async () => {
      const res = await saveUserPermissions(saved.user.id, denied);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setSaved(res.data);
      setAllowed(Object.fromEntries(res.data.permissions.map((p) => [p.key, p.allowed])));
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
              </span>
              {!(allowed[p.key] ?? true) && <Badge tone="danger">Denied</Badge>}
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={save} disabled={!dirty || isPending}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </Card>
  );
}
