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

/**
 * User ids for the same two accounts above — needed because
 * TokenService.issueTokenPair/rotateRefreshToken only ever see a userId,
 * never the phone (User.phoneHash is a one-way hash, not reversible).
 *
 * 2026-09-14: multiple real testers share these two accounts across
 * several devices at once (App Store/Play Store review needs one login,
 * but in practice this project's own testers are all using the same
 * numbers concurrently). The normal auth model allows exactly one live
 * refresh token per user (User.refreshTokenHash, rotated on every use) —
 * every new login or refresh silently invalidates every other device's
 * session, which reads as "keeps logging out" when two people are on it
 * at once. These two ids are exempted from that single-session model in
 * TokenService (their refresh tokens are validated by JWT signature +
 * expiry alone, never cross-checked against a stored hash) so any number
 * of devices can stay logged in simultaneously. Every other account keeps
 * the existing single-active-session security model unchanged.
 */
export const DEMO_ACCOUNT_USER_IDS = new Set<string>([
  '2797c547-60ed-4f03-8cab-d83f2a154565', // mentor demo account ("test")
  'f65fc1a7-2b48-427e-9228-9b75ffb8d489', // aspirant demo account ("Steady Raven #2798")
]);

export function isDemoAccountUserId(userId: string): boolean {
  return DEMO_ACCOUNT_USER_IDS.has(userId);
}

export function normalisePhone(phone: string): string {
  return phone.replace(/\s+/g, '').trim();
}

export function isDemoAccountPhone(phone: string): boolean {
  return DEMO_ACCOUNT_PHONES.has(normalisePhone(phone));
}
