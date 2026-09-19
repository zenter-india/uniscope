import * as Sentry from '@sentry/node';

/**
 * Error tracking (2026-09-19, added after a real recurring pain point in
 * this project's own history — several production bugs, e.g. the iOS
 * push/APNs investigation and the "10-minute logout" root-cause, needed a
 * FRESH reproduction to diagnose because Railway's own log retention had
 * already rotated past the original incident by the time anyone looked).
 * Sentry keeps a stack trace + request context the moment something
 * actually throws, independent of log retention.
 *
 * Deliberately a separate file, imported as the very first line of
 * main.ts (before any other import) — Sentry's own Node SDK instruments
 * other modules (http, the DB driver, etc.) as they're `require`d, so it
 * must run before anything else pulls those modules in. Importing it any
 * later than main.ts's first line silently loses that auto-instrumentation.
 *
 * Deliberately inert with no SENTRY_DSN set — every environment (local
 * dev, this sandbox, a fresh Railway service) works exactly as before
 * until a real DSN is configured; nothing here is required for the app to
 * function. No error-tracing/profiling turned on (tracesSampleRate: 0) —
 * this is plain error capture only, not performance monitoring, to keep
 * the addition small and avoid burning through Sentry's free-tier trace
 * quota on a marketplace app that doesn't need APM yet.
 */
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0,
  });
}
