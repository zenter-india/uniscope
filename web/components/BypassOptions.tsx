"use client";

import { useEffect, type RefObject } from "react";

/** The two escape hatches shown under every college / specialization search
 * list: a hint to retry the search in a different form, and a "Not listed
 * here" row that lets the user type their own value. Typing alone only
 * searches -- a value that isn't picked from the list is accepted only after
 * "Not listed here" is chosen (see useRequirePick). Mirrors the mobile app's
 * OnboardingBypassOptions. */
export function BypassOptions({
  example,
  onNotListed,
}: {
  example: string;
  onNotListed: () => void;
}) {
  return (
    // mousedown on anything in here must not blur the input above, or its
    // onBlur close-timer can win the race against the click on a touch
    // device (same fix as the option buttons in the pickers).
    <div className="border-t border-border" onMouseDown={(e) => e.preventDefault()}>
      <div className="px-3.5 py-2.5">
        <p className="text-[13px] font-semibold text-ink">Try searching in a different form</p>
        <p className="mt-0.5 text-[12px] text-muted">{example}</p>
      </div>
      <button
        type="button"
        onClick={onNotListed}
        className="w-full border-t border-border px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-blue-600 hover:bg-[#eef3ff]"
      >
        Not listed here
      </button>
    </div>
  );
}

/** "Back to search" link shown under the input once "Not listed here" is on. */
export function BackToSearch({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1.5 text-[12.5px] font-semibold text-blue-600 hover:underline"
    >
      Back to search
    </button>
  );
}

export const EXAMPLE_COLLEGE =
  'e.g. search "Jawaharlal Nehru Postgraduate Institute" instead of "JIPMER"';
export const EXAMPLE_GENERIC =
  "e.g. search the full name instead of a short form or abbreviation";

/** Blocks native form submission (HTML5 validity) while the input holds text
 * that wasn't picked from the list and "Not listed here" hasn't been chosen.
 * The parent still receives the raw text on every keystroke as before; only
 * submission is gated. */
export function useRequirePick(
  inputRef: RefObject<HTMLInputElement | null>,
  valid: boolean,
) {
  useEffect(() => {
    inputRef.current?.setCustomValidity(
      valid ? "" : "Pick one from the list, or choose “Not listed here” to enter your own.",
    );
  }, [inputRef, valid]);
}
