"use client";

import { useState } from "react";
import { TextInput } from "./form-bits";

/** Browsable + type-to-search picker over an already-known, small list of
 * options held entirely client-side (e.g. a college's own specialization
 * list) — no network call per keystroke, filtering happens locally.
 * Focusing with no query shows the full option list; typing narrows it,
 * same UX as CollegeSearch/CuratedCollegeSearch. A typed value matching
 * nothing in the list is still accepted as free text via onChange. */
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
  const filtered = value.trim()
    ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase()))
    : options;

  return (
    <div className="relative">
      <TextInput
        gold={gold}
        required
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-border rounded-[11px] shadow-lg max-h-56 overflow-auto">
          {filtered.map((option) => (
            <li key={option}>
              <button
                type="button"
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
      )}
    </div>
  );
}
