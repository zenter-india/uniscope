'use client';

import { useRef, useState, useTransition } from 'react';
import { Badge, Button, Table, fieldClass } from '../../../components/ui';
import { toast } from '../../../lib/toast';
import { updateUniversity, uploadUniversityPhoto } from './actions';

export interface UniversityRowData {
  id: string;
  name: string;
  slug: string;
  state: string;
  city: string | null;
  stream: string | null;
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
    state: university.state,
    city: university.city ?? '',
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
          state: form.state,
          city: form.city,
          establishedYear: form.establishedYear ? Number(form.establishedYear) : undefined,
          website: form.website || undefined,
        });
        setEditing(false);
        toast.success(`Saved ${form.name}.`);
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
        toast.success(
          university.isActive ? `${university.name} deactivated.` : `${university.name} activated.`,
        );
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
      toast.success('Cover photo updated.');
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (editing) {
    return (
      <tr>
        <td colSpan={4} className="p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name"
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
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button variant="successSolid" size="sm" onClick={save} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button size="sm" onClick={() => setEditing(false)} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <Table.Row>
      <Table.Cell>
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
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 hover:border-zinc-400 disabled:opacity-50"
          >
            {uploadingPhoto ? (
              <span className="text-xs">…</span>
            ) : university.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={university.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px]">Add</span>
            )}
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-zinc-900">{university.name}</span>
              {university.stream && <Badge>{university.stream}</Badge>}
            </div>
            {photoError && <p className="mt-0.5 text-xs text-red-600">{photoError}</p>}
            {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap text-xs text-zinc-500">
        {[university.city, university.state].filter(Boolean).join(', ')}
      </Table.Cell>
      <Table.Cell>
        <Badge tone={university.isActive ? 'success' : 'danger'}>
          {university.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </Table.Cell>
      <Table.Cell>
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant={university.isActive ? 'dangerSolid' : 'secondary'}
            onClick={toggleActive}
            disabled={isPending}
          >
            {university.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </Table.Cell>
    </Table.Row>
  );
}
