"use client";

import { useState } from "react";

/** Shared step/progress state for both enrollment forms — kept as a plain
 * hook rather than a shared <StepForm> component because the two forms'
 * steps differ enough (mentor has a college search + file upload, aspirant
 * doesn't) that a generic wrapper would need as many escape hatches as it
 * saves. */
export function useMultiStep(totalSteps: number) {
  const [step, setStep] = useState(1);

  return {
    step,
    totalSteps,
    isFirst: step === 1,
    isLast: step === totalSteps,
    progressPct: Math.round((step / totalSteps) * 100),
    next: () => setStep((s) => Math.min(s + 1, totalSteps)),
    back: () => setStep((s) => Math.max(s - 1, 1)),
    reset: () => setStep(1),
  };
}
