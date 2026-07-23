'use client';

import { useState, useTransition } from 'react';
import { createUniversity } from './actions';

const TYPES = ['GOVERNMENT', 'PRIVATE', 'DEEMED', 'CENTRAL'];

const EMPTY = {
  name: '',
  type: 'GOVERNMENT',
  state: '',
  city: '',
  nirfRank: '',
  mbbsSeats: '',
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
          type: form.type,
          state: form.state,
          city: form.city,
          nirfRank: form.nirfRank ? Number(form.nirfRank) : undefined,
          mbbsSeats: form.mbbsSeats ? Number(form.mbbsSeats) : undefined,
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
    <div className="w-full basis-full rounded-xl border border-zinc-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-zinc-900">New university</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
          value={form.nirfRank}
          onChange={(e) => setForm({ ...form, nirfRank: e.target.value })}
          placeholder="NIRF rank"
          type="number"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
        <input
          value={form.mbbsSeats}
          onChange={(e) => setForm({ ...form, mbbsSeats: e.target.value })}
          placeholder="MBBS seats"
          type="number"
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
