'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CollegePicker } from '../universities/CollegePicker';
import type { CollegeOption } from '../universities/actions';

const SELECT_CLASS =
  'h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm outline-none transition-colors focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-600/40 max-md:h-11 max-md:flex-1 min-w-0 md:max-w-[16rem]';

export interface FilterOption {
  name: string;
  users: number;
}

/** A value from the address that isn't in the list (e.g. nobody has it any
 * more) must still show as selected, not silently read "All". */
function withCurrent(options: FilterOption[], current: string): FilterOption[] {
  return !current || options.some((o) => o.name === current)
    ? options
    : [{ name: current, users: 0 }, ...options];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 max-md:w-full">
      <span className="max-md:w-24 max-md:shrink-0">{label}</span>
      {children}
    </label>
  );
}

/**
 * The Users list's search and filters. One plain GET form: the page reads the
 * query string, the dropdowns apply as soon as they change, and the role /
 * verification / banned choices made with the tabs above are carried along in
 * hidden fields so they are not lost.
 *
 *  - Search finds a name, a specialization or a college.
 *  - Always shown: Specialization and Level (UG / PG).
 *  - "More filters": Degree, Stream, State, Accepting calls, and College.
 */
export function UserFilters({
  search,
  specialization,
  level,
  qualification,
  stream,
  state,
  accepting,
  universityId,
  collegeName,
  carried,
  options,
  clearHref,
}: {
  search: string;
  specialization: string;
  level: '' | 'UG' | 'PG';
  qualification: string;
  stream: string;
  state: string;
  accepting: boolean;
  universityId: string;
  collegeName: string;
  /** role / verificationStatus / banned / sort / dir already chosen. */
  carried: Record<string, string>;
  options: {
    specializations: FilterOption[];
    qualifications: FilterOption[];
    streams: FilterOption[];
    states: FilterOption[];
  };
  /** The address with every filter and the search removed. */
  clearHref: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  const [college, setCollege] = useState<CollegeOption | null>(
    universityId ? { id: universityId, name: collegeName || 'Selected college', city: null, state: '' } : null,
  );
  // Picking (or clearing) a college applies it straight away, like the dropdowns.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    submit();
  }, [college?.id]);

  const optionLabel = (o: FilterOption) => (o.users > 0 ? `${o.name} (${o.users})` : o.name);
  const moreActive = [qualification, stream, state, accepting ? 'x' : '', universityId].filter(Boolean).length;
  const anyFilter = !!(search || specialization || level || moreActive);

  return (
    <form ref={formRef} method="get" action="/dashboard/users" className="flex flex-col gap-3">
      {Object.entries(carried).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {college && (
        <>
          <input type="hidden" name="universityId" value={college.id} />
          <input type="hidden" name="collegeName" value={college.name} />
        </>
      )}

      <div className="flex w-full gap-2">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search a name, specialization or college…"
          className="min-w-0 flex-1 sm:max-w-md rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-600/40"
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 max-md:h-11"
        >
          Search
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Field label="Specialization">
          <select
            name="specialization"
            defaultValue={specialization}
            onChange={submit}
            className={SELECT_CLASS}
          >
            <option value="">All specializations</option>
            {withCurrent(options.specializations, specialization).map((o) => (
              <option key={o.name} value={o.name}>
                {optionLabel(o)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Level">
          <select name="level" defaultValue={level} onChange={submit} className={SELECT_CLASS}>
            <option value="">UG and PG</option>
            <option value="UG">UG</option>
            <option value="PG">PG</option>
          </select>
        </Field>
        {anyFilter && (
          <Link
            href={clearHref}
            className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear filters
          </Link>
        )}
      </div>

      <details open={moreActive > 0} className="group">
        <summary className="cursor-pointer select-none text-sm font-medium text-zinc-600 dark:text-zinc-300 max-md:py-1.5">
          More filters{moreActive > 0 ? ` (${moreActive} on)` : ''}
        </summary>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Field label="Degree">
            <select
              name="qualification"
              defaultValue={qualification}
              onChange={submit}
              className={SELECT_CLASS}
            >
              <option value="">All degrees</option>
              {withCurrent(options.qualifications, qualification).map((o) => (
                <option key={o.name} value={o.name}>
                  {optionLabel(o)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stream">
            <select name="stream" defaultValue={stream} onChange={submit} className={SELECT_CLASS}>
              <option value="">All streams</option>
              {withCurrent(options.streams, stream).map((o) => (
                <option key={o.name} value={o.name}>
                  {optionLabel(o)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="State">
            <select name="state" defaultValue={state} onChange={submit} className={SELECT_CLASS}>
              <option value="">All states</option>
              {withCurrent(options.states, state).map((o) => (
                <option key={o.name} value={o.name}>
                  {optionLabel(o)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Calls">
            <select
              name="accepting"
              defaultValue={accepting ? 'true' : ''}
              onChange={submit}
              className={SELECT_CLASS}
            >
              <option value="">Any mentor</option>
              <option value="true">Accepting calls</option>
            </select>
          </Field>
          <div className="flex w-full items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 sm:w-96">
            <span className="shrink-0 max-md:w-24">College</span>
            <div className="min-w-0 flex-1">
              <CollegePicker
                excludeId=""
                selected={college}
                onSelect={setCollege}
                placeholder="Only people of one college…"
              />
            </div>
          </div>
        </div>
      </details>
    </form>
  );
}
