"use client";

import { useEffect, useRef, useState } from "react";
import { fetchCuratedColleges, type CuratedCollege } from "../lib/api";
import { TextInput } from "./form-bits";

/** Browsable + type-to-search College/University picker for a stream+degree
 * whose data is small enough to browse in full (MD/MS today) — same UX as
 * CollegeSearch (focusing with no query shows a default list, typing
 * narrows it), but backed by GET /universities/curated?browse=true instead
 * of the general /universities search, so the picked college's own
 * specializations come back in the same payload (see onPick) rather than
 * needing a second lookup.
 *
 * A typed value that matches nothing in the list is still accepted as free
 * text (onPick(name, null)), same fallback as CollegeSearch/the DNB-style
 * curated dropdowns' "Other" option — just without a separate menu item. */
export function CuratedCollegeSearch({
  stream,
  degree,
  value,
  onPick,
  gold,
}: {
  stream: string;
  degree: string;
  value: string;
  onPick: (college: CuratedCollege | null, name: string) => void;
  gold?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<CuratedCollege[]>([]);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  // Same "search on every value including empty" approach as CollegeSearch,
  // for the same reason: focusing the field should show a browsable list
  // immediately, not only once the mentor starts typing.
  useEffect(() => {
    const thisRequest = ++requestId.current;
    const handle = setTimeout(() => {
      fetchCuratedColleges(stream, degree, { browse: true, search: query.trim() || undefined })
        .then((data) => {
          if (thisRequest === requestId.current) setResults(data);
        })
        .catch(() => {
          if (thisRequest === requestId.current) setResults([]);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [stream, degree, query]);

  return (
    <div className="relative">
      <TextInput
        gold={gold}
        required
        placeholder="Select or type to search…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onPick(null, e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-border rounded-[11px] shadow-lg max-h-56 overflow-auto">
          {results.map((college) => (
            <li key={college.id}>
              <button
                type="button"
                onClick={() => {
                  setQuery(college.label);
                  onPick(college, college.label);
                  setOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 text-[13.5px] font-semibold ${gold ? "hover:bg-[#fbf1de]" : "hover:bg-[#eef3ff]"}`}
              >
                {college.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
