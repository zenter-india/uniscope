"use client";

import { useRef, useState } from "react";
import { TextInput } from "./form-bits";
import { BackToSearch, BypassOptions, EXAMPLE_GENERIC, useRequirePick } from "./BypassOptions";

/** Browsable + type-to-search picker over an already-known, small list of
 * options held entirely client-side (e.g. a college's own specialization
 * list) — no network call per keystroke, filtering happens locally.
 * Focusing with no query shows the full option list; typing narrows it,
 * same UX as CollegeSearch/CuratedCollegeSearch.
 *
 * Typing only searches. A value that isn't in the list is accepted only after
 * the user chooses "Not listed here" (plain text entry); until the text
 * matches an option or that option is chosen, native form submission is
 * blocked (useRequirePick). onChange still fires with the raw text on every
 * keystroke so parents that widen `options` while the user types keep working.
 *
 * Matching is keyword-based, not a single whole-phrase substring: the
 * typed value is split on whitespace into words, and an option matches
 * if EVERY typed word appears somewhere in it (each independently, any
 * order, any position) — so e.g. "medicine emergency" still matches
 * "Emergency Medicine" even though that's not literally the typed
 * substring, and a specialization can be found by any word inside it,
 * not just its beginning. Per explicit request. */
export function SearchableCombobox({
  value,
  options,
  onChange,
  placeholder,
  gold,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  gold?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // "Not listed here" chosen: plain text entry, no list.
  const [manual, setManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const words = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = words.length
    ? options.filter((o) => {
        const lower = o.toLowerCase();
        return words.every((w) => lower.includes(w));
      })
    : options;

  const typed = value.trim().toLowerCase();
  useRequirePick(
    inputRef,
    manual || disabled === true || options.some((o) => o.toLowerCase() === typed),
  );

  const enterManual = () => {
    setManual(true);
    setOpen(false);
    onChange("");
    inputRef.current?.focus();
  };

  const backToSearch = () => {
    setManual(false);
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <TextInput
        ref={inputRef}
        gold={gold}
        required
        disabled={disabled}
        placeholder={manual ? "Type it here" : placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!manual) setOpen(true);
        }}
        onFocus={() => {
          if (!manual) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {manual && <BackToSearch onClick={backToSearch} />}
      {open && !manual && !disabled && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-border rounded-[11px] shadow-lg overflow-hidden">
          <ul className="max-h-56 overflow-auto">
            {filtered.length === 0 && (
              <li className="px-3.5 py-2.5 text-[13px] text-muted">No matches</li>
            )}
            {filtered.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  // Same fix as CollegeSearch.tsx/CuratedCollegeSearch.tsx's
                  // own version -- prevents the TextInput above from ever
                  // blurring when this is tapped, so onBlur's setTimeout
                  // close can't win the race against this button's own
                  // click on a real touch device and silently swallow the
                  // pick.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-[13.5px] font-semibold ${gold ? "hover:bg-[#fbf1de]" : "hover:bg-[#eef3ff]"}`}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
          <BypassOptions example={EXAMPLE_GENERIC} onNotListed={enterManual} />
        </div>
      )}
    </div>
  );
}
