'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../../components/icons';
import { fieldClass } from '../../../components/ui';
import { loadSpecializationOptions, type SpecializationOption } from './actions';

// One request per degree for the whole page: every card of the same degree
// shares the answer. An empty result (a failed lookup) is dropped so the next
// card that needs it tries again.
const optionsByDegree = new Map<string, Promise<SpecializationOption[]>>();

function optionsFor(degree: string): Promise<SpecializationOption[]> {
  const key = degree.trim().toUpperCase();
  let pending = optionsByDegree.get(key);
  if (!pending) {
    pending = loadSpecializationOptions(key).then((list) => {
      if (list.length === 0) optionsByDegree.delete(key);
      return list;
    });
    optionsByDegree.set(key, pending);
  }
  return pending;
}

/** How well `name` fits what was typed: 0 exact, 1 every typed word starts a
 * word of the name, 2 every typed word appears somewhere, null no match. */
function matchRank(name: string, query: string): number | null {
  if (!query) return 2;
  const n = name.toLowerCase();
  if (n === query) return 0;
  const tokens = query.split(/\s+/).filter(Boolean);
  if (!tokens.every((t) => n.includes(t))) return null;
  const words = n.split(/[\s\-/(),]+/);
  return tokens.every((t) => words.some((w) => w.startsWith(t))) ? 1 : 2;
}

const MAX_SHOWN = 60;

/**
 * The specialization name box on the approval queue. It is still a normal text
 * box — a brand-new name can be typed — but it suggests the names already in
 * our data for the same degree, so the admin picks the existing, correctly
 * spelled one ("MD - Microbiology") instead of approving a half-typed one
 * ("microb"). The arrow opens the whole list.
 */
export function SpecializationNameInput({
  value,
  onChange,
  degree,
  disabled,
  className = '',
}: {
  value: string;
  onChange: (name: string) => void;
  degree: string;
  disabled?: boolean;
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<SpecializationOption[] | null>(null);
  const [open, setOpen] = useState(false);
  // Opened with the arrow: show every name, not just those matching the text.
  const [browse, setBrowse] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    let alive = true;
    void optionsFor(degree).then((list) => {
      if (alive) setOptions(list);
    });
    return () => {
      alive = false;
    };
  }, [degree]);

  const typed = value.trim();
  const query = browse ? '' : typed.toLowerCase();

  // A few hundred names at most, so this is cheap to recompute on each render.
  const shown = (options ?? [])
    .map((option) => ({ option, rank: matchRank(option.name, query) }))
    .filter(
      (m): m is { option: SpecializationOption; rank: number } => m.rank !== null,
    )
    .sort((a, b) => a.rank - b.rank || a.option.name.localeCompare(b.option.name))
    .slice(0, MAX_SHOWN)
    .map((m) => m.option);

  const exact = options?.find((o) => o.name.toLowerCase() === typed.toLowerCase());

  useEffect(() => {
    if (!open || active < 0) return;
    document
      .getElementById(`${listId}-option-${active}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setBrowse(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(shown.length > 0 ? 0 : -1);
      } else {
        setActive((i) => Math.min(i + 1, shown.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      if (!open) return;
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && shown[active]) {
        e.preventDefault();
        pick(shown[active].name);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setBrowse(false);
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className={`relative w-full ${className}`}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setBrowse(false);
        }
      }}
    >
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setBrowse(false);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        maxLength={100}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-option-${active}` : undefined}
        aria-label="Specialization name shown to users"
        className={`${fieldClass} pr-9`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={open && browse ? 'Hide the list of names' : 'Show all names for this degree'}
        // Keep focus in the input so opening the list doesn't blur it.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open && browse) {
            setOpen(false);
            setBrowse(false);
          } else {
            setBrowse(true);
            setOpen(true);
            setActive(-1);
            rootRef.current?.querySelector('input')?.focus();
          }
        }}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-zinc-400 hover:text-zinc-600 disabled:opacity-50 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        <Icon.chevronDown className="h-4 w-4" />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {options === null ? (
            <li className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              Loading names…
            </li>
          ) : shown.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              {options.length === 0
                ? 'No names to suggest for this degree.'
                : 'No existing name matches what you typed.'}
            </li>
          ) : (
            shown.map((option, i) => (
              <li
                key={option.name}
                id={`${listId}-option-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: runs before the input loses focus.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option.name);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 ${
                  i === active ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                }`}
              >
                <span>{option.name}</span>
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                  {option.colleges.toLocaleString()} college{option.colleges === 1 ? '' : 's'}
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {options !== null && options.length > 0 && typed !== '' && (
        <p
          className={`mt-1 text-xs ${
            exact
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {exact
            ? `✓ On our list for ${degree} (${exact.colleges.toLocaleString()} college${exact.colleges === 1 ? '' : 's'}).`
            : 'Not on our list yet — approving adds it as a new name.'}
        </p>
      )}
    </div>
  );
}
