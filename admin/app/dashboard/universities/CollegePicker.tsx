'use client';

import { useEffect, useRef, useState } from 'react';
import { fieldClass } from '../../../components/ui';
import { searchColleges, type CollegeOption } from './actions';
import { locationLabel } from './location';

export const collegeLabel = (c: CollegeOption) => {
  const place = locationLabel(c);
  return place ? `${c.name} — ${place}` : c.name;
};

/** Searchable dropdown of the colleges already in our DB (name + district +
 * state). Selecting one is a request to merge into it. */
export function CollegePicker({
  excludeId,
  selected,
  onSelect,
  placeholder = 'Pick an existing college (name, district, state)…',
}: {
  excludeId: string;
  selected: CollegeOption | null;
  onSelect: (c: CollegeOption | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CollegeOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Bumped whenever the query changes, so a slow "next page" response for an
  // old query can never be appended to the new query's list.
  const generation = useRef(0);

  useEffect(() => {
    if (!open) return;
    const gen = ++generation.current;
    const t = setTimeout(async () => {
      // Set from the debounce callback, not the effect body (react-hooks/
      // set-state-in-effect), so the spinner shows once the search starts.
      setLoading(true);
      setLoadingMore(false);
      try {
        const res = await searchColleges(query);
        if (gen !== generation.current) return;
        setOptions(res.data.filter((c) => c.id !== excludeId));
        setNextCursor(res.nextCursor);
      } catch {
        if (gen !== generation.current) return;
        setOptions([]);
        setNextCursor(null);
      } finally {
        if (gen === generation.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, excludeId]);

  // No cap: when the admin scrolls near the bottom, fetch the next page and
  // keep going until the whole (filtered) list has been loaded.
  const loadMore = async () => {
    if (!nextCursor || loading || loadingMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    try {
      const res = await searchColleges(query, nextCursor);
      if (gen !== generation.current) return;
      setOptions((prev) => [...prev, ...res.data.filter((c) => c.id !== excludeId)]);
      setNextCursor(res.nextCursor);
    } catch {
      // Leave the cursor so scrolling again retries.
    } finally {
      if (gen === generation.current) setLoadingMore(false);
    }
  };

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
        placeholder={placeholder}
        className={fieldClass}
      />
      {open && !selected && (
        <ul
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) void loadMore();
          }}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-zinc-300 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
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
                  {locationLabel(c)}
                </span>
              </button>
            </li>
          ))}
          {loadingMore && <li className="px-3 py-1.5 text-zinc-500">Loading more…</li>}
        </ul>
      )}
    </div>
  );
}
