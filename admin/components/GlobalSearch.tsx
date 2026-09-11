'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './icons';
import { globalSearch, type GlobalSearchResult } from '../app/dashboard/search-actions';

const EMPTY: GlobalSearchResult = { users: [], universities: [] };

interface FlatItem {
  key: string;
  href: string;
}

/**
 * Header quick-search. Type ≥2 chars (or press "/" anywhere to focus) to
 * look up a user by name / registry id / UUID, or a college by name / city.
 * Picking a result navigates to its page. Arrow keys move a highlight
 * through the flattened (users, then colleges) result list; Enter opens the
 * highlighted row (or the first one, if none has been highlighted yet);
 * Escape closes the panel.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<GlobalSearchResult>(EMPTY);
  const [highlight, setHighlight] = useState(-1);
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
        // A new query's results shouldn't inherit the previous query's highlight.
        setHighlight(-1);
      });
    }, 200);
    return () => clearTimeout(id);
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };

  // Same (users, then universities) order the panel renders in, so the
  // highlight index lines up with what's on screen and with Enter's pick.
  const flatItems = useMemo<FlatItem[]>(
    () => [
      ...res.users.map((u) => ({ key: `user-${u.id}`, href: `/dashboard/users/${u.id}` })),
      ...res.universities.map((u) => ({
        key: `uni-${u.id}`,
        href: `/dashboard/universities?search=${encodeURIComponent(u.name)}`,
      })),
    ],
    [res],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || flatItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(flatItems[highlight >= 0 ? highlight : 0].href);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
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
          if (v.trim().length < 2) {
            setRes(EMPTY);
            setHighlight(-1);
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search users, colleges…  /"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-listbox"
        aria-activedescendant={
          highlight >= 0 && flatItems[highlight] ? flatItems[highlight].key : undefined
        }
        className="h-8 w-56 rounded-md border border-zinc-300 bg-white pl-8 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition-colors placeholder:text-zinc-400 focus:w-72 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40"
      />

      {showPanel && (
        <div
          id="global-search-listbox"
          role="listbox"
          className="absolute right-0 top-full z-20 mt-1.5 max-h-[70vh] w-80 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
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
              {res.users.map((u, i) => (
                <button
                  key={u.id}
                  id={flatItems[i]?.key}
                  role="option"
                  aria-selected={highlight === i}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => go(`/dashboard/users/${u.id}`)}
                  className={
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ' +
                    (highlight === i ? 'bg-zinc-100' : 'hover:bg-zinc-50')
                  }
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
              {res.universities.map((u, i) => {
                const flatIndex = res.users.length + i;
                return (
                  <button
                    key={u.id}
                    id={flatItems[flatIndex]?.key}
                    role="option"
                    aria-selected={highlight === flatIndex}
                    onMouseEnter={() => setHighlight(flatIndex)}
                    onClick={() =>
                      go(`/dashboard/universities?search=${encodeURIComponent(u.name)}`)
                    }
                    className={
                      'flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm ' +
                      (highlight === flatIndex ? 'bg-zinc-100' : 'hover:bg-zinc-50')
                    }
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
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
