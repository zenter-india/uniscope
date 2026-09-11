/**
 * App Store / Play Store reviewer demo accounts (2026-09-12).
 *
 * Apple/Google review needs to be able to log in as a real mentor and a
 * real aspirant without receiving a real SMS — these two phone numbers
 * aren't real, deliverable numbers, so the live `msg91` OTP provider can
 * never text them. Rather than flipping the whole backend into `mock`
 * mode (which would let *any* phone number log in with a fixed code —
 * a real security loosening for every live user, not just these two),
 * login is bypassed only for this exact allowlist: everyone else still
 * goes through the real provider unchanged.
 *
 * The two accounts themselves (roles, verification, wallet balance) are
 * documented in CLAUDE.md under "App Store review demo accounts."
 */
export const DEMO_ACCOUNT_PHONES = new Set<string>([
  '+919999999999', // mentor — verified, review-gate cleared, "Accepting calls" on
  '+918888888888', // aspirant — 500 Uniminutes
]);

export const DEMO_ACCOUNT_OTP_CODE = '424242';

export function normalisePhone(phone: string): string {
  return phone.replace(/\s+/g, '').trim();
}

export function isDemoAccountPhone(phone: string): boolean {
  return DEMO_ACCOUNT_PHONES.has(normalisePhone(phone));
}
