'use client';

import { useState, useTransition } from 'react';
import { Button, Card, fieldClass } from '../../../components/ui';
import { toast } from '../../../lib/toast';
import { createUniversity } from './actions';

const EMPTY = {
  name: '',
  stream: '',
  state: '',
  city: '',
  establishedYear: '',
  website: '',
};

export function AddUniversityForm() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!form.name.trim() || !form.state.trim() || !form.city.trim()) {
      setError('Name, state, and city are required');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createUniversity({
          name: form.name,
          stream: form.stream || undefined,
          state: form.state,
          city: form.city,
          establishedYear: form.establishedYear ? Number(form.establishedYear) : undefined,
          website: form.website || undefined,
        });
        toast.success(`${form.name} added.`);
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not create university';
        setError(msg);
        toast.error(msg);
      }
    });
  };

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)}>
        + Add University
      </Button>
    );
  }

  return (
    <Card className="w-full basis-full p-4">
      <p className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">New university</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name"
          className={fieldClass}
        />
        <input
          value={form.stream}
          onChange={(e) => setForm({ ...form, stream: e.target.value })}
          placeholder="Stream (e.g. Medical, Engineering)"
          className={fieldClass}
        />
        <input
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
          placeholder="State"
          className={fieldClass}
        />
        <input
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="City"
          className={fieldClass}
        />
        <input
          value={form.establishedYear}
          onChange={(e) => setForm({ ...form, establishedYear: e.target.value })}
          placeholder="Established year"
          type="number"
          className={fieldClass}
        />
        <input
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          placeholder="Website URL"
          className={fieldClass}
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button variant="successSolid" size="sm" onClick={submit} disabled={isPending}>
          {isPending ? 'Creating…' : 'Create'}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setOpen(false);
            setForm(EMPTY);
            setError(null);
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}
