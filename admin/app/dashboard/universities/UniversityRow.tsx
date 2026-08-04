'use client';

import { useRef, useState, useTransition } from 'react';
import { updateUniversity, uploadUniversityPhoto } from './actions';

const TYPES = ['GOVERNMENT', 'PRIVATE', 'DEEMED', 'CENTRAL'];

interface UniversityRowData {
  id: string;
  name: string;
  slug: string;
  type: string;
  state: string;
  city: string | null;
  nirfRank: number | null;
  mbbsSeats: number | null;
  establishedYear: number | null;
  website: string | null;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function UniversityRow({ university }: { university: UniversityRowData }) {
  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: university.name,
    type: university.type,
    state: university.state,
    city: university.city ?? '',
    nirfRank: university.nirfRank?.toString() ?? '',
    mbbsSeats: university.mbbsSeats?.toString() ?? '',
    establishedYear: university.establishedYear?.toString() ?? '',
    website: university.website ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateUniversity(university.id, {
          name: form.name,
          type: form.type,
          state: form.state,
          city: form.city,
          nirfRank: form.nirfRank ? Number(form.nirfRank) : undefined,
          mbbsSeats: form.mbbsSeats ? Number(form.mbbsSeats) : undefined,
          establishedYear: form.establishedYear ? Number(form.establishedYear) : undefined,
          website: form.website || undefined,
        });
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save');
      }
    });
  };

  const toggleActive = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateUniversity(university.id, { isActive: !university.isActive });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update');
      }
    });
  };

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const base64 = await fileToBase64(file);
      await uploadUniversityPhoto(university.id, base64);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
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
            onClick={save}
            disabled={isPending}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPhotoSelected}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPhoto}
          title="Upload cover photo"
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 hover:border-zinc-400 disabled:opacity-50"
        >
          {uploadingPhoto ? (
            <span className="text-xs">…</span>
          ) : university.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={university.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs">Add</span>
          )}
        </button>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-zinc-900">{university.name}</p>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {university.type}
            </span>
            {!university.isActive && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {[university.city, university.state].filter(Boolean).join(', ')}
            {university.nirfRank ? ` · NIRF #${university.nirfRank}` : ''}
            {university.mbbsSeats ? ` · ${university.mbbsSeats} seats` : ''}
          </p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Edit
        </button>
        <button
          onClick={toggleActive}
          disabled={isPending}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
            university.isActive
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          {university.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  );
}
