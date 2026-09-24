"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

/** Vercel Analytics has no built-in "time on page" metric — this fires one
 * cookieless custom event if the visitor is still on the page after 15s,
 * as a lightweight stand-in ("did anyone actually read this, or bounce
 * immediately"). No timer/interval keeps running afterward. */
export function EngagementPing() {
  useEffect(() => {
    const timer = setTimeout(() => track("engaged_15s"), 15_000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
