'use client';

import { useEffect, useRef, useState } from 'react';
import { fieldClass } from '../../../components/ui';
import { searchColleges, type CollegeOption } from './actions';

export const collegeLabel = (c: CollegeOption) =>
  `${c.name} — ${[c.city, c.state].filter(Boolean).join(', ')}`;

/** Searchable dropdown of the colleges already in our DB (name + district +
 * state). Selecting one is a request to merge into it. */
export function CollegePicker({
  excludeId,
  selected,
  onSelect,
}: {
  excludeId: string;
  selected: CollegeOption | null;
  onSelect: (c: CollegeOption | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CollegeOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchColleges(query);
        if (!cancelled) setOptions(res.filter((c) => c.id !== excludeId));
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open, excludeId]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        value={selected ? collegeLabel(selected) : query}
        onChange={(e) => {
          if (selected) onSelect(null);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Pick an existing college (name, district, state)…"
        className={fieldClass}
      />
      {open && !selected && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-300 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {loading && <li className="px-3 py-1.5 text-zinc-500">Searching…</li>}
          {!loading && options.length === 0 && (
            <li className="px-3 py-1.5 text-zinc-500">No matching colleges.</li>
          )}
          {options.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {c.name}
                <span className="ml-1 text-xs text-zinc-500">
                  {[c.city, c.state].filter(Boolean).join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
