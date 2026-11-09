'use client';

import { useRef } from 'react';

const SELECT_CLASS =
  'h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm outline-none transition-colors focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-600/40';

/** Search box + Course filter + Sort for the Universities list. A plain GET
 * form (the page reads the query string); the two dropdowns submit as soon
 * as they change, so there is no extra "Apply" step. */
export function UniversityFilters({
  search,
  course,
  sort,
  courses,
}: {
  search: string;
  course: string;
  sort: 'name' | 'name_desc' | 'new';
  courses: { name: string; colleges: number }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  // A course from the URL that isn't in the list (e.g. emptied since) must
  // still show as selected rather than silently reading "All courses".
  const options = courses.some((c) => c.name === course) || !course
    ? courses
    : [{ name: course, colleges: 0 }, ...courses];

  return (
    <form ref={formRef} className="flex flex-wrap items-center gap-2" action="/dashboard/universities">
      <input
        type="text"
        name="search"
        defaultValue={search}
        placeholder="Search by name, district, city, state…"
        className="w-72 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 shadow-sm outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-zinc-600/40"
      />
      <label className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        Course
        <select name="course" defaultValue={course} onChange={submit} className={SELECT_CLASS}>
          <option value="">All courses</option>
          {options.map((c) => (
            <option key={c.name} value={c.name}>
              {c.colleges > 0 ? `${c.name} (${c.colleges})` : c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        Sort
        <select name="sort" defaultValue={sort} onChange={submit} className={SELECT_CLASS}>
          <option value="name">Alphabet (A–Z)</option>
          <option value="name_desc">Alphabet (Z–A)</option>
          <option value="new">Newest first</option>
        </select>
      </label>
      <button
        type="submit"
        className="inline-flex h-9 items-center rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
      >
        Search
      </button>
    </form>
  );
}
