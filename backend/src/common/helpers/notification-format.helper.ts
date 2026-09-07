/**
 * Amount formatting for notification bodies — kept in one place so every
 * money-moving notification reads consistently and follows the locked-in
 * currency rule: aspirant-facing copy is in Uniminutes, mentor-facing copy
 * (earnings, payouts) is in rupees.
 */

/** 1 Uniminute = 1000 minor units (₹10). Locked product constant — mirrors
 * UNIMINUTE_VALUE_MINOR in wallet.service.ts, re-declared here so this
 * string helper stays free of any module dependency. */
const MINOR_PER_UNIMINUTE = 1000;

/** Aspirant-facing amount: whole Uniminutes, sign-agnostic. */
export function uniminutesLabel(minor: number): string {
  const n = Math.round(Math.abs(minor) / MINOR_PER_UNIMINUTE);
  return `${n} ${n === 1 ? 'Uniminute' : 'Uniminutes'}`;
}

/** Mentor-facing amount: rupees, sign-agnostic, trailing ".00" dropped. */
export function rupeesLabel(minor: number): string {
  const rupees = Math.abs(minor) / 100;
  return `₹${Number.isInteger(rupees) ? rupees.toFixed(0) : rupees.toFixed(2)}`;
}
