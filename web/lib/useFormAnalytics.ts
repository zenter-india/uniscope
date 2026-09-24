"use client";

import { useEffect, useRef } from "react";
import { track } from "@vercel/analytics";

/** Cookieless funnel tracking for a multi-step enrollment form — fires
 * `${name}_started` on mount, `${name}_submitted` once `done` flips true,
 * and `${name}_abandoned` (with the step reached) if the form unmounts
 * before `done` is true. Vercel Analytics events carry no persistent
 * identifier, just a timestamped occurrence count, so this needs no
 * consent banner — see app/layout.tsx and app/privacy/page.tsx.
 *
 * `done`/`step` are read via refs inside the unmount cleanup rather than
 * as effect deps, since the cleanup must see the *latest* values at
 * unmount time, not whatever they were when the mount effect first ran.
 *
 * In `next dev` you'll see started→abandoned→started fire back-to-back on
 * first mount — that's React StrictMode's dev-only double-invoke of
 * mount/cleanup, not a bug. Verified with `next build && next start`
 * (StrictMode's double-invoke is stripped in production) that the mount
 * effect really only fires once for a real mount. */
export function useFormAnalytics(name: string, done: boolean, step: number) {
  const doneRef = useRef(done);
  const stepRef = useRef(step);
  useEffect(() => {
    doneRef.current = done;
  }, [done]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    track(`${name}_started`);
    return () => {
      if (!doneRef.current) {
        track(`${name}_abandoned`, { step: stepRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount, refs carry the latest done/step at unmount
  }, []);

  useEffect(() => {
    if (done) track(`${name}_submitted`);
  }, [name, done]);
}
