# SOP 07: Triaging errors in Sentry

**Purpose:** find the errors that matter and fix them, without chasing noise.
**Who:** the developer on duty. **When:** weekly, and after each release.

## Where
Sentry org `amsel-gold`. Projects: `uniscope-backend` and `uniscope-mobile`. There are only two environments: `preview` and `production`. Ignore anything else.

## What counts as real
- **Real:** it happens to users on production, repeats, or breaks a core flow (login, chat, wallet, calls, verification).
- **Noise:** one-off network timeouts, user-cancelled actions, known third-party errors, and anything only from Preview or local runs. A shared filter drops known noise on mobile (`mobile_flutter/lib/core/sentry_filter.dart`); add to it deliberately.

## Steps
1. Open the project, filter to `environment:production`, last 7 days (last 24 hours after a release).
2. Sort by events and by users affected. Open the top few.
3. Read the stack trace and breadcrumbs. Decide: **real, noise, or needs more information**.
4. For a real one, create a Notion item (Type Bug, Epic that matches the area), link the Sentry issue, and fix it through SOP 01. Add a test where you can.
5. For noise, resolve or ignore it in Sentry with a note, or filter it in code.
6. After your fix ships, check the issue stops recurring. Do not mark it done on the merge alone.

## Check it worked
The issue stops appearing after the release that fixed it, and the weekly list has no unexplained top items.

## Notes
- Backend tracing is off (`tracesSampleRate` 0); Sentry is for errors only.
- A real database or payment error is a High-tier area: tell Kiran.

Last checked: 2026-11-28.
