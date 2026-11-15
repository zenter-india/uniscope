"use client";

import { useEffect, useRef, useState } from "react";
import { searchUniversities, University } from "../lib/api";
import { TextInput } from "./form-bits";
import { BackToSearch, BypassOptions, EXAMPLE_COLLEGE, useRequirePick } from "./BypassOptions";

/** Shared college picker for both enrollment forms — debounced live search
 * against the public GET /universities, plus a default browsable list (not
 * just search-after-typing): focusing the field with no query yet still
 * fetches and shows a list, so a mentor can either scroll/pick or type to
 * narrow it, both in the same control.
 *
 * Typing only searches. A college not in the list is accepted only after the
 * user chooses "Not listed here" (which turns the box into plain text entry);
 * until a college is picked or that option is chosen, native form submission
 * is blocked (useRequirePick). onPick(query, null) still fires on every
 * keystroke so the parent keeps the raw text, matching
 * CreateAspirantLeadDto/CreateMentorLeadDto.
 *
 * `level` (e.g. "UG") restricts the list to colleges offering that level —
 * pass it for a degree-specific picker so PG-only accreditation sites don't
 * show up as UG options (see UniversitiesService.findAll's `level` filter).
 * `stream` (e.g. "Dental") restricts to that stream's colleges — always
 * pass it when the stream has seeded data of its own (every stream with
 * a College field backed by real data does, as of Medical/Dental/
 * Engineering/Law). Omitting it used to be safe for Medical specifically
 * back when it was the only stream with any seeded colleges at all; that
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
  // "Not listed here" chosen: plain text entry, no list.
  const [manual, setManual] = useState(false);
  // The label of the college last picked from the list, if the text still
  // equals it.
  const [picked, setPicked] = useState<string | null>(null);
  const requestId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useRequirePick(inputRef, manual || (picked !== null && picked === query));

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
    if (manual) return;
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
  }, [query, level, stream, manual]);

  const enterManual = () => {
    setManual(true);
    setOpen(false);
    setPicked(null);
    setQuery("");
    onPick("", null);
    inputRef.current?.focus();
  };

  const backToSearch = () => {
    setManual(false);
    setQuery("");
    onPick("", null);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <TextInput
        ref={inputRef}
        gold={gold}
        required
        placeholder={manual ? "Enter your college name" : "Select or type to search…"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!manual) {
            setOpen(true);
            setPicked(null);
          }
          onPick(e.target.value, null);
        }}
        onFocus={() => {
          if (!manual) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {manual && <BackToSearch onClick={backToSearch} />}
      {open && !manual && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-border rounded-[11px] shadow-lg overflow-hidden">
          <ul className="max-h-56 overflow-auto">
            {results.length === 0 && (
              <li className="px-3.5 py-2.5 text-[13px] text-muted">No matches</li>
            )}
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
                    setPicked(u.name);
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
          <BypassOptions example={EXAMPLE_COLLEGE} onNotListed={enterManual} />
        </div>
      )}
    </div>
  );
}
