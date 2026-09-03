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
 * `stream` (e.g. "Dental") restricts to that stream's colleges — always
 * pass it when the stream has seeded data of its own (every stream with
 * a College field backed by real data does, as of Medical/Dental/
 * Engineering/Law). Omitting it used to be safe for Medical specifically
 * back when it was the only stream with any seeded colleges at all (an
 * unfiltered search could only ever resolve to Medical anyway) -- that
 * stopped being true once Dental/Engineering/Law got their own data, and
 * an unfiltered Medical search started surfacing their colleges too (a
 * real bug, caught live -- see MentorForm.tsx's own CollegeSearch call
 * for Medical, which now always passes stream="Medical"). Only omit
 * `stream` for a stream with no seeded college data of its own at
 * all -- there every candidate would be wrong regardless of stream. */
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

  // Keeps the visible text in sync when the parent resets `value` out from
  // under this component without the mentor/aspirant typing anything
  // themselves -- e.g. MentorForm.tsx/AspirantForm.tsx both clear
  // collegeName when Stream or Degree/Qualification changes. Same fix as
  // CuratedCollegeSearch.tsx's own version of this -- see that component's
  // comment for the full writeup of why this matters (a stale-but-
  // HTML5-valid display that could let someone submit believing their
  // college was saved when it wasn't).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing the visible text to a `value` reset the parent made, not an internal state transition
    setQuery(value);
  }, [value]);

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
                // Same fix as CuratedCollegeSearch.tsx's own version --
                // prevents the TextInput above from ever blurring when
                // this is tapped, so onBlur's setTimeout close can't win
                // the race against this button's own click on a real
                // touch device and silently swallow the pick. See that
                // component's comment for the full writeup.
                onMouseDown={(e) => e.preventDefault()}
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
