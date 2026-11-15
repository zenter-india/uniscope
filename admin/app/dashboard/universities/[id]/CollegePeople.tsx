'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Badge, Card, toneFor } from '../../../../components/ui';

export interface CollegePerson {
  id: string;
  displayName: string;
  verificationStatus: string;
  isBanned: boolean;
  qualification: string | null;
  level: 'UG' | 'PG' | 'OTHER';
  stream: string | null;
  specialization: string | null;
  yearOfStudy: number | null;
  graduationYear: number | null;
}

const byName = (a: CollegePerson, b: CollegePerson) =>
  a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base', numeric: true });

/** "MD/MS · Community Medicine · Year 2" — the education details shown under a name. */
function educationLine(p: CollegePerson): string {
  const year =
    p.graduationYear != null
      ? `Graduated ${p.graduationYear}`
      : p.yearOfStudy != null
        ? `Year ${p.yearOfStudy}`
        : null;
  return [p.qualification, p.specialization, p.stream, year].filter(Boolean).join(' · ');
}

const SEARCH_CLASS =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/40';

function PersonRow({ person, showStatus }: { person: CollegePerson; showStatus: boolean }) {
  const line = educationLine(person);
  return (
    <li>
      <Link
        href={`/dashboard/users/${person.id}`}
        className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-50 max-md:min-h-12 dark:hover:bg-zinc-800/60"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{person.displayName}</span>
          {showStatus && (
            <Badge tone={toneFor(person.verificationStatus)}>
              {person.verificationStatus.replace('_', ' ').toLowerCase()}
            </Badge>
          )}
          {person.isBanned && <Badge tone="danger">banned</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {line || 'No education details yet'}
        </p>
      </Link>
    </li>
  );
}

function Pane({
  title,
  count,
  note,
  controls,
  children,
}: {
  title: string;
  count: number;
  note?: string;
  controls: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{count}</span>
      </div>
      <div className="mb-3 flex flex-col gap-2">{controls}</div>
      {note && <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">{note}</p>}
      {children}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      {children}
    </p>
  );
}

/**
 * The two sides of a college page: students (left) and mentors (right). Every
 * person is a link to their profile and is listed A–Z. Mentors can be narrowed
 * to UG or PG first, then to one specialization of that level.
 */
export function CollegePeople({
  aspirants,
  mentors,
  truncated,
}: {
  aspirants: CollegePerson[];
  mentors: CollegePerson[];
  truncated: { mentors: boolean; aspirants: boolean };
}) {
  const [studentQuery, setStudentQuery] = useState('');
  const [mentorQuery, setMentorQuery] = useState('');
  const [level, setLevel] = useState<'ALL' | 'UG' | 'PG' | 'OTHER'>('ALL');
  const [specialization, setSpecialization] = useState('');

  const students = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return [...aspirants].filter((p) => !q || p.displayName.toLowerCase().includes(q)).sort(byName);
  }, [aspirants, studentQuery]);

  const levelCounts = useMemo(() => {
    const c = { ALL: mentors.length, UG: 0, PG: 0, OTHER: 0 };
    for (const m of mentors) c[m.level] += 1;
    return c;
  }, [mentors]);

  const atLevel = useMemo(
    () => (level === 'ALL' ? mentors : mentors.filter((m) => m.level === level)),
    [mentors, level],
  );

  // The specializations that exist at the chosen level, A–Z with counts.
  const specializations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of atLevel) {
      if (m.specialization) counts.set(m.specialization, (counts.get(m.specialization) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }),
    );
  }, [atLevel]);

  const shownMentors = useMemo(() => {
    const q = mentorQuery.trim().toLowerCase();
    return atLevel
      .filter((m) => !specialization || m.specialization === specialization)
      .filter((m) => !q || m.displayName.toLowerCase().includes(q))
      .sort(byName);
  }, [atLevel, specialization, mentorQuery]);

  const levels: { key: 'ALL' | 'UG' | 'PG' | 'OTHER'; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'UG', label: 'UG' },
    { key: 'PG', label: 'PG' },
    ...(levelCounts.OTHER > 0 ? [{ key: 'OTHER' as const, label: 'Other' }] : []),
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Pane
        title="Students"
        count={students.length}
        note={truncated.aspirants ? 'Showing the first 1000 students.' : undefined}
        controls={
          <input
            type="search"
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder="Search students by name…"
            className={SEARCH_CLASS}
          />
        }
      >
        {students.length === 0 ? (
          <Empty>{aspirants.length === 0 ? 'No students are linked to this college yet.' : 'No student matches.'}</Empty>
        ) : (
          <ul className="-mx-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {students.map((p) => (
              <PersonRow key={p.id} person={p} showStatus={false} />
            ))}
          </ul>
        )}
      </Pane>

      <Pane
        title="Mentors"
        count={shownMentors.length}
        note={truncated.mentors ? 'Showing the first 1000 mentors.' : undefined}
        controls={
          <>
            <div role="group" aria-label="Level" className="flex flex-wrap gap-1.5">
              {levels.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => {
                    setLevel(l.key);
                    setSpecialization('');
                  }}
                  aria-pressed={level === l.key}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors max-md:py-2.5 ${
                    level === l.key
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  {l.label} <span className="opacity-70">({levelCounts[l.key]})</span>
                </button>
              ))}
            </div>
            {specializations.length > 0 ? (
              <select
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                aria-label="Specialization"
                className={SEARCH_CLASS}
              >
                <option value="">
                  All specializations ({atLevel.filter((m) => m.specialization).length})
                </option>
                {specializations.map(([name, n]) => (
                  <option key={name} value={name}>
                    {name} ({n})
                  </option>
                ))}
              </select>
            ) : (
              mentors.length > 0 && (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  No specializations recorded for {level === 'ALL' ? 'these mentors' : `${level} mentors`}.
                </p>
              )
            )}
            <input
              type="search"
              value={mentorQuery}
              onChange={(e) => setMentorQuery(e.target.value)}
              placeholder="Search mentors by name…"
              className={SEARCH_CLASS}
            />
          </>
        }
      >
        {shownMentors.length === 0 ? (
          <Empty>
            {mentors.length === 0
              ? 'No mentors are linked to this college yet.'
              : 'No mentor matches these filters.'}
          </Empty>
        ) : (
          <ul className="-mx-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {shownMentors.map((p) => (
              <PersonRow key={p.id} person={p} showStatus />
            ))}
          </ul>
        )}
      </Pane>
    </div>
  );
}
