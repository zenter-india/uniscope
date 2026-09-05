'use client';

import { useState, useTransition } from 'react';
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
        setForm(EMPTY);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create university');
      }
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        + Add University
      </button>
    );
  }

  return (
    <div className="w-full basis-full rounded-lg border border-zinc-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-zinc-900">New university</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <input
          value={form.stream}
          onChange={(e) => setForm({ ...form, stream: e.target.value })}
          placeholder="Stream (e.g. Medical, Engineering)"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <input
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
          placeholder="State"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <input
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder="City"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <input
          value={form.establishedYear}
          onChange={(e) => setForm({ ...form, establishedYear: e.target.value })}
          placeholder="Established year"
          type="number"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <input
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          placeholder="Website URL"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={isPending}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Create
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setForm(EMPTY);
            setError(null);
          }}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
