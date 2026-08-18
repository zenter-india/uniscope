"use client";

import { useEffect, useRef, useState } from "react";
import { searchUniversities, University } from "../lib/api";
import { TextInput } from "./form-bits";

/** Shared college picker for both enrollment forms — debounced live search
 * against the public GET /universities. A college not in this list is still
 * accepted: onPick(query, null) below keeps the raw text so the lead never
 * loses the answer, matching CreateAspirantLeadDto/CreateMentorLeadDto. */
export function CollegeSearch({
  value,
  onPick,
  gold,
}: {
  value: string;
  onPick: (name: string, id: string | null) => void;
  gold?: boolean;
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
  useEffect(() => {
    // Below the 2-char threshold, just skip scheduling a search — the render
    // guard below (`query.trim().length >= 2`) hides any stale `results`
    // rather than this effect clearing them, since a synchronous setState
    // right in the effect body (not inside the async .then()/.catch() below)
    // is exactly the pattern React's set-state-in-effect rule flags.
    if (query.trim().length < 2) return;
    const thisRequest = ++requestId.current;
    const handle = setTimeout(() => {
      searchUniversities(query)
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
  }, [query]);

  return (
    <div className="relative">
      <TextInput
        gold={gold}
        required
        placeholder="Start typing to search…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onPick(e.target.value, null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && query.trim().length >= 2 && results.length > 0 && (
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
                {u.name}
                <span className="block text-[11.5px] font-medium text-slate-400">
                  {u.city ? `${u.city}, ` : ""}
                  {u.state}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
