'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './icons';
import { globalSearch, type GlobalSearchResult } from '../app/dashboard/search-actions';

const EMPTY: GlobalSearchResult = { users: [], universities: [] };

/**
 * Header quick-search. Type ≥2 chars (or press "/" anywhere to focus) to
 * look up a user by name / registry id / UUID, or a college by name / city.
 * Picking a result navigates to its page.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<GlobalSearchResult>(EMPTY);
  const [isPending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the box from anywhere that isn't already a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Debounced search on every keystroke (queries < 2 chars never reach here
  // with anything to do — `res` is cleared in the change handler instead).
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const id = setTimeout(() => {
      startTransition(async () => {
        setRes(await globalSearch(query));
      });
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };

  const hasResults = res.users.length > 0 || res.universities.length > 0;
  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative hidden sm:block">
      <Icon.search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          setOpen(true);
          if (v.trim().length < 2) setRes(EMPTY);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search users, colleges…  /"
        className="h-8 w-56 rounded-md border border-zinc-300 bg-white pl-8 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:w-72 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40"
      />

      {showPanel && (
        <div className="absolute right-0 top-full z-20 mt-1.5 max-h-[70vh] w-80 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {isPending && !hasResults && (
            <p className="px-3 py-2 text-xs text-zinc-400">Searching…</p>
          )}
          {!isPending && !hasResults && (
            <p className="px-3 py-2 text-xs text-zinc-400">No matches.</p>
          )}

          {res.users.length > 0 && (
            <div>
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Users
              </p>
              {res.users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => go(`/dashboard/users/${u.id}`)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50"
                >
                  <span className="truncate font-medium text-zinc-900">{u.displayName}</span>
                  <span className="ml-auto shrink-0 text-xs text-zinc-400">{u.role}</span>
                  {u.isBanned && (
                    <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                      banned
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {res.universities.length > 0 && (
            <div>
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Colleges
              </p>
              {res.universities.map((u) => (
                <button
                  key={u.id}
                  onClick={() =>
                    go(`/dashboard/universities?search=${encodeURIComponent(u.name)}`)
                  }
                  className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-zinc-900">{u.name}</span>
                    <span className="block truncate text-xs text-zinc-400">
                      {[u.city, u.state].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  {!u.isActive && (
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                      inactive
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
