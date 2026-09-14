// Minimal in-memory fixed-window rate limiter for a single hot path:
// POST /api/auth/login. No new infra (Redis, KV) for one endpoint's login
// guessing brake — the admin panel otherwise has zero direct DB/cache
// connectivity by design, it only ever talks to the backend (see
// lib/backend.ts's own doc comment).
//
// Real limitation, stated plainly rather than glossed over: this app is
// deployed on Vercel, where each serverless function invocation can land on
// a different warm instance (or a fresh cold start), and this Map lives in
// one instance's memory. Under real concurrent traffic across instances,
// the effective limit is "per warm instance", not truly global -- so this
// raises the bar against a single naive script a lot, but is not a hard
// guarantee against a distributed attacker. If that gap ever actually
// matters (this becomes a real target, not just a theoretical one), the
// fix is routing this check through the backend's existing Redis-backed
// ThrottlerModule instead of reinventing one here.
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Opportunistic cleanup so `buckets` can't grow unbounded across a long-
 * lived warm instance -- runs inline on each call rather than a timer,
 * since a serverless function has no long-lived background scheduler. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Returns { limited: false } if this identifier still has attempts left
 * this window (and records one), or { limited: true, retryAfterSeconds }
 * if it's out. Call once per login attempt, regardless of outcome -- a
 * counted success doesn't defeat the point (a legitimate admin logs in
 * rarely enough that this limit is never a real obstacle for them). */
export function checkLoginRateLimit(
  identifier: string,
): { limited: false } | { limited: true; retryAfterSeconds: number } {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(identifier);
  if (!existing || existing.resetAt <= now) {
    buckets.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false };
  }

  if (existing.count >= MAX_ATTEMPTS) {
    return { limited: true, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { limited: false };
}
