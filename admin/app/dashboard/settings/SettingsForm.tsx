'use client';

import { useState, useTransition } from 'react';
import { Button, Card } from '../../../components/ui';
import { updateSettings, type Setting } from './actions';

export function SettingsForm({ initial }: { initial: Setting[] }) {
  const [settings, setSettings] = useState(initial);
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(initial.map((s) => [s.key, String(s.value)])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const changed = settings.filter((s) => draft[s.key] !== String(s.value));

  const save = () => {
    setError(null);
    setSaved(false);

    const updates: Record<string, number> = {};
    for (const s of changed) {
      const n = Number(draft[s.key]);
      if (!Number.isFinite(n)) {
        setError(`${s.label} must be a number.`);
        return;
      }
      if (n < s.min || n > s.max) {
        setError(`${s.label} must be between ${s.min} and ${s.max} ${s.unit}.`);
        return;
      }
      updates[s.key] = n;
    }
    if (Object.keys(updates).length === 0) return;

    startTransition(async () => {
      const res = await updateSettings(updates);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSettings(res.settings);
      setDraft(Object.fromEntries(res.settings.map((s) => [s.key, String(s.value)])));
      setSaved(true);
    });
  };

  const resetOne = (s: Setting) => {
    setDraft((d) => ({ ...d, [s.key]: String(s.default) }));
    setSaved(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {settings.map((s) => (
        <Card key={s.key} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900">{s.label}</p>
              <p className="mt-1 text-sm text-zinc-500">{s.description}</p>
              <p className="mt-1 text-xs text-zinc-400">
                Default {s.default} {s.unit} · allowed range {s.min}–{s.max} {s.unit}
                {s.isDefault && (
                  <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                    using default
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input
                type="number"
                value={draft[s.key]}
                min={s.min}
                max={s.max}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, [s.key]: e.target.value }));
                  setSaved(false);
                }}
                className="w-24 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-right text-sm text-zinc-900 shadow-sm outline-none transition-colors focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40"
              />
              <span className="text-sm text-zinc-500">{s.unit}</span>
              {draft[s.key] !== String(s.default) && (
                <Button size="sm" onClick={() => resetOne(s)} disabled={isPending}>
                  Reset
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-600">Saved.</p>}

      <div>
        <Button
          variant="primary"
          onClick={save}
          disabled={isPending || changed.length === 0}
        >
          {isPending
            ? 'Saving…'
            : changed.length === 0
              ? 'Save changes'
              : `Save ${changed.length} change${changed.length > 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
