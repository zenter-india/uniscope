"use client";

import { useEffect, useState } from "react";
import { checkAliasAvailable } from "./api";

export type AliasStatus = "idle" | "checking" | "free" | "taken";

export const ALIAS_TAKEN_MESSAGE =
  "This name is already in use. Please choose a different alias to continue.";

/** Checks the alias while the person types (after a short pause). `taken`
 * means someone already uses it; a check that could not run reads as `idle`,
 * never as `taken`, so a network problem can't stop anyone from signing up. */
export function useAliasCheck(alias: string): AliasStatus {
  const [result, setResult] = useState<{ alias: string; free: boolean | null } | null>(null);
  const value = alias.trim();

  useEffect(() => {
    if (value.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkAliasAvailable(value).then((free) => {
        if (!cancelled) setResult({ alias: value, free });
      });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  if (value.length < 2) return "idle";
  if (!result || result.alias !== value) return "checking";
  if (result.free === null) return "idle";
  return result.free ? "free" : "taken";
}
