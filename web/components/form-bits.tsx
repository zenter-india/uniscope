"use client";

/** Small shared building blocks for the two enrollment forms. Kept dumb and
 * prop-driven — no fetching, no form-library dependency — since the forms
 * are short enough that plain useState per field is easier to read than
 * wiring up a form library for two five-step wizards. */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-[13px] font-bold text-ink mb-1.5">
        {label}
        {hint && <span className="font-semibold text-slate-400"> {hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full px-3.5 py-3 rounded-[11px] border-[1.5px] border-border text-[14.5px] " +
  "bg-white text-ink focus:outline-none focus:border-blue-600 transition-colors";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { gold?: boolean },
) {
  const { gold, className, ...rest } = props;
  return (
    <input
      {...rest}
      className={`${inputClass} ${gold ? "focus:border-gold-500" : ""} ${className ?? ""}`}
    />
  );
}

export function Select({
  gold,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { gold?: boolean }) {
  return (
    <select {...rest} className={`${inputClass} ${gold ? "focus:border-gold-500" : ""}`}>
      {children}
    </select>
  );
}

export function ChipGroup({
  options,
  selected,
  onToggle,
  gold,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  gold?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            aria-pressed={isSelected}
            className={`px-3.5 py-2 rounded-full border-[1.5px] text-[13px] font-bold transition-all active:scale-[0.94] ${
              isSelected
                ? gold
                  ? "bg-gold-500 border-gold-500 text-white scale-[1.03]"
                  : "bg-blue-600 border-blue-600 text-white scale-[1.03]"
                : "bg-white border-border text-slate-600 hover:border-slate-400"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** Toggles `value` in/out of a string array — the pattern every chip group
 * in both forms uses for its onToggle. */
export function toggleInArray(arr: string[], value: string, multi = true): string[] {
  if (!multi) return arr.includes(value) ? [] : [value];
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function ProgressBar({ pct, gold }: { pct: number; gold?: boolean }) {
  return (
    <div className="h-1.5 rounded-full bg-border overflow-hidden mb-6">
      <div
        className={`h-full rounded-full transition-all duration-300 ${
          gold
            ? "bg-gradient-to-r from-gold-600 to-gold-400"
            : "bg-gradient-to-r from-blue-600 to-sky-300"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-[13px] font-semibold text-red-600 mt-2">{message}</p>;
}
