'use client';

import Link from 'next/link';
import { useRef, type ReactNode } from 'react';

const SELECT_CLASS =
  'h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm outline-none transition-colors focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-600/40 max-md:h-11 max-md:flex-1';

interface Option {
  name: string;
  colleges: number;
}

/** A value from the address that isn't in the list (e.g. it no longer matches
 * any college) must still show as selected, not silently read "All". */
function withCurrent(options: Option[], current: string): Option[] {
  return !current || options.some((o) => o.name === current)
    ? options
    : [{ name: current, colleges: 0 }, ...options];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 max-md:w-full">
      <span className="max-md:w-16 max-md:shrink-0">{label}</span>
      {children}
    </label>
  );
}

/** Search box + the Universities list's filters (State, Stream, Status, Course)
 * and Sort. A plain GET form — the page reads the query string — and the
 * dropdowns submit as soon as they change, so there is no extra "Apply" step. */
export function UniversityFilters({
  search,
  state,
  stream,
  status,
  course,
  sort,
  states,
  streams,
  courses,
}: {
  search: string;
  state: string;
  stream: string;
  status: '' | 'active' | 'inactive';
  course: string;
  sort: 'name' | 'name_desc' | 'new';
  states: Option[];
  streams: Option[];
  courses: Option[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  const filtered = !!(search || state || stream || status || course);

  const optionLabel = (o: Option) => (o.colleges > 0 ? `${o.name} (${o.colleges})` : o.name);

  return (
    <form ref={formRef} className="flex flex-wrap items-center gap-2" action="/dashboard/universities">
      <input
        type="text"
        name="search"
        defaultValue={search}
        placeholder="Search by name, district, city, state…"
        className="w-72 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-600/40 max-md:w-full"
      />
      <Field label="Status">
        <select name="status" defaultValue={status} onChange={submit} className={SELECT_CLASS}>
          <option value="">All colleges</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive (not published)</option>
        </select>
      </Field>
      <Field label="State">
        <select name="state" defaultValue={state} onChange={submit} className={SELECT_CLASS}>
          <option value="">All states</option>
          {withCurrent(states, state).map((o) => (
            <option key={o.name} value={o.name}>
              {optionLabel(o)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Stream">
        <select name="stream" defaultValue={stream} onChange={submit} className={SELECT_CLASS}>
          <option value="">All streams</option>
          {withCurrent(streams, stream).map((o) => (
            <option key={o.name} value={o.name}>
              {optionLabel(o)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Course">
        <select name="course" defaultValue={course} onChange={submit} className={SELECT_CLASS}>
          <option value="">All courses</option>
          {withCurrent(courses, course).map((o) => (
            <option key={o.name} value={o.name}>
              {optionLabel(o)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Sort">
        <select name="sort" defaultValue={sort} onChange={submit} className={SELECT_CLASS}>
          <option value="name">Alphabet (A–Z)</option>
          <option value="name_desc">Alphabet (Z–A)</option>
          <option value="new">Newest first</option>
        </select>
      </Field>
      <button
        type="submit"
        className="inline-flex h-9 items-center rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 max-md:h-11"
      >
        Search
      </button>
      {filtered && (
        <Link
          href={`/dashboard/universities?sort=${sort}`}
          className="text-sm text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Clear filters
        </Link>
      )}
    </form>
  );
}
