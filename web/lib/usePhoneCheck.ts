"use client";

import { useEffect, useState } from "react";
import { checkPhoneAvailable } from "./api";

export type PhoneStatus = "idle" | "checking" | "free" | "taken";

export const PHONE_TAKEN_MESSAGE =
  "This phone number already has an account. Please use a different number.";

/** Checks the number once all 10 digits are typed (after a short pause).
 * `taken` means it already has an account that can't be used for this
 * sign-up; a check that could not run reads as `idle`, never as `taken`, so a
 * network problem can't stop anyone from signing up (the server still refuses
 * the submission if the number really is taken). */
export function usePhoneCheck(phone: string, role: "ASPIRANT" | "MENTOR"): PhoneStatus {
  const [result, setResult] = useState<{ phone: string; free: boolean | null } | null>(null);
  const value = phone.trim();

  useEffect(() => {
    if (value.length !== 10) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkPhoneAvailable(value, role).then((free) => {
        if (!cancelled) setResult({ phone: value, free });
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, role]);

  if (value.length !== 10) return "idle";
  if (!result || result.phone !== value) return "checking";
  if (result.free === null) return "idle";
  return result.free ? "free" : "taken";
}
