"use client";

import { useEffect, useRef, useState } from "react";
import { searchUniversities, University } from "../lib/api";
import { TextInput } from "./form-bits";

/** Shared college picker for both enrollment forms — debounced live search
 * against the public GET /universities, plus a default browsable list (not
 * just search-after-typing): focusing the field with no query yet still
 * fetches and shows a list, so a mentor can either scroll/pick or type to
 * narrow it, both in the same control. A college not in this list is still
 * accepted: onPick(query, null) below keeps the raw text so the lead never
 * loses the answer, matching CreateAspirantLeadDto/CreateMentorLeadDto.
 *
 * `level` (e.g. "UG") restricts the list to colleges offering that level —
 * pass it for a degree-specific picker so PG-only accreditation sites don't
 * show up as UG options (see UniversitiesService.findAll's `level` filter).
 * `stream` (e.g. "Dental") restricts to that stream's colleges — omit it
 * for a stream with no seeded data yet, since an unfiltered search would
 * otherwise surface irrelevant colleges from whichever stream does have
 * data (currently Medical). */
export function CollegeSearch({
  value,
  onPick,
  gold,
  level,
  stream,
}: {
  value: string;
  onPick: (name: string, id: string | null) => void;
  gold?: boolean;
  level?: string;
  stream?: string;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<University[]>([]);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  // Deliberately does NOT compare `query` against the `value` prop to decide
  // whether to search: onPick fires on every keystroke to keep the parent's
  // collegeName in sync as free text, which lands `value` back at `query` on
  // the very next render — a naive "skip if unchanged" guard would fire after
  // every single keystroke and wipe the results that keystroke just fetched.
  //
  // Runs on an empty query too (unlike a typical "search" effect) so the
  // list is populated as soon as the field is focused, not only once the
  // mentor starts typing — that's what makes this a browsable dropdown
  // rather than search-only.
  useEffect(() => {
    const thisRequest = ++requestId.current;
    const handle = setTimeout(() => {
      searchUniversities(query, level, stream)
        .then((res) => {
          // Ignore if a newer keystroke has already started a later request
          // — otherwise a slow response for "A" can land after a fast one
          // for "A J" and stomp the more specific results back to noise.
          if (thisRequest === requestId.current) setResults(res.data);
        })
        .catch(() => {
          if (thisRequest === requestId.current) setResults([]);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [query, level, stream]);

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
          onPick(e.target.value, null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-border rounded-[11px] shadow-lg max-h-56 overflow-auto">
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => {
                  setQuery(u.name);
                  onPick(u.name, u.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 text-[13.5px] font-semibold ${gold ? "hover:bg-[#fbf1de]" : "hover:bg-[#eef3ff]"}`}
              >
                {u.name}, {u.state}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
