# Uniscope — Project Context for Claude Code

Mentorship marketplace connecting prospective medical students (Aspirants) with verified mentors (current students/alumni) for chat and paid audio-call guidance, plus honest college reviews.

**Branch:** `feature/flutter-migration` (mobile was ported from React Native to Flutter mid-project; backend/admin unaffected).

## Stack

| Layer | Tech |
|---|---|
| Mobile | Flutter (`mobile_flutter/`) — Riverpod, go_router, Dio |
| Backend | NestJS + TypeScript (`backend/`) — Prisma 7 ORM |
| Database | PostgreSQL on Supabase (pooler connection; `DIRECT_URL` bypasses pooler for migrations) |
| Admin panel | Next.js (`admin/`) — single hardcoded admin login, kept as a **separately-deployed, non-public** surface (not linked from user-facing app) |
| Auth | Phone OTP (Twilio Verify, or `mock` provider for local dev — logs OTP to console) + JWT access/refresh |
| Real-time chat | Stream Chat |
| Audio calls | Agora (RTC token server built; see below) |
| Payments | Razorpay (Orders API + webhook, also a direct client-confirm fallback for local dev since webhooks need a public URL) |

Root is an npm workspace monorepo (`backend`, `admin`; `mobile_flutter` is separate/Flutter, not an npm workspace member).

## Local dev setup

- Backend: `cd backend && npm run start:dev` (or build+run `dist/main.js` directly — see below). Runs on port **3001**, prefix `/api/v1`.
- Admin: `npm run dev --workspace=admin` — **must use `next dev --webpack`**, not the Turbopack default (Turbopack can't resolve `lightningcss`'s native binding in this monorepo's hoisted `node_modules`; already fixed in `admin/package.json`).
- Mobile: `flutter run --dart-define=API_URL=http://10.0.2.2:3001/api/v1` for Android emulator (localhost aliasing), or your LAN IP for a physical device.
- All secrets live in `backend/.env` and `admin/.env.local` (both gitignored). See `backend/.env.example` for the full list — Supabase, Twilio, Redis (Upstash), Razorpay, Stream Chat, Agora, JWT secrets are all already populated in the working `.env` for this project's own accounts.
- Admin login (local dev): credentials are in `admin/.env.local` (`ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET`) — not committed.
- **A recurring dev-server gotcha:** the Supabase free-tier project auto-pauses after inactivity; if DB calls start failing, check the Supabase dashboard shows the project "Active" and retry.
- **Backend restart pattern used throughout this project's history** (Claude_Preview MCP tools were unreliable mid-session): `rm -f tsconfig.build.tsbuildinfo && npx tsc -p tsconfig.build.json && node dist/main.js` backgrounded, health-check via `curl localhost:3001/health`.

## Prisma workflow (Prisma 7 — syntax changed from earlier versions)

- No `url` in `datasource db` block — reads `DATABASE_URL`/`DIRECT_URL` from `prisma.config.ts`.
- Generate a migration from a schema diff (works against the live dev DB, non-interactive-safe):
  ```
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
  ```
  Then hand-create the migration folder (`prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql`, 14-digit timestamp prefix required) and `npx prisma migrate deploy`.
- For **enum value remaps** (not just additions), Prisma's diff tool can't express the data transformation — hand-write the migration using the create-new-type / `ALTER TABLE ... USING (CASE ...)` / drop-old-type / rename pattern. See `prisma/migrations/20260712125549_collapse_user_role_to_aspirant_mentor/migration.sql` for a worked example (this preserved existing user data instead of resetting).
- `prisma migrate dev` and `migrate reset` require a TTY — don't work in a non-interactive agent session. Use `migrate diff` + `migrate deploy` instead.

## Business model decisions (locked in, don't re-litigate without asking)

- **Roles:** collapsed to `ASPIRANT` / `MENTOR` / `ADMIN` (previously 4 granular roles — migrated, not reset).
- **Currency:** "Uniminutes" wallet. Internally still paise-denominated (`Wallet.balanceMinor`, `LedgerEntry.amountMinor` — architecture principle: money is always integer minor units, never floats), but 1 Uniminute = 1000 minor units = ₹10, matching the **flat mentor call payout rate** (all mentors currently earn the same ₹10/min for calls — this was a late-session decision that supersedes an earlier "per-mentor custom rate" discussion; worth double-checking with the user if extending this).
- **Recharge margin:** min ₹250 recharge credits 20 Uniminutes (₹200 of spendable value) — the 20% margin is baked into the recharge conversion only, **never** shown to the user as a line item, and **never** taken again at session-billing time (mentor gets paid the exact same amount debited from the aspirant). See `WalletService.computeTopupCredit`.
- **Audio call billing:** fixed pre-paid slots only — 5/10/20 min (`CreateSessionDto.CALL_SLOT_MINUTES`), not live per-minute metering. Student picks a slot at booking; balance is checked and a `WalletHold` placed **at booking time**, before the mentor ever sees the request.
- **Free tier:** 2 free chat sessions + 10 free call minutes per aspirant (`UserProfile.freeChatsRemaining` / `freeCallSecondsRemaining`).
- **Call connect confirmation:** billing only fires once **both** the aspirant's and mentor's clients independently report "I joined" (`POST /sessions/:id/call/joined`) — an interim fraud-resistance measure until a real Agora server-side "user joined channel" webhook is configured (needs additional Agora Console setup the user hasn't done yet). Neither party alone can trigger a charge.
- **Call overrun:** hard cutoff at slot end, with a "continue?" popup offering another fixed +5 min block (`POST /sessions/:id/call/extend`), billed the same way as the original booking.
- **Mentor-side call drop:** still bills the aspirant in full — **never** an automatic refund. The aspirant gets a Report action; an admin manually reviews and can issue a `REFUND` ledger entry via `PATCH /reports/:id/resolve`. See `ReportsService.resolve`.
- **Support chat:** a persistent, session-independent Stream Chat channel per user with a fixed "UniScope Support" identity (`SUPPORT_ACCOUNT_ID` in `chat.service.ts`), lazily provisioned via `GET /chat/support/token`. This is what the "Need Help?" banner in the UI is wired to.

## What's built (backend modules, all tested live against the real Supabase DB + real Stream/Razorpay/Agora APIs — not just unit-style tests)

- `auth` — Phone OTP (Twilio/mock) + JWT
- `users` — profile CRUD, role transitions
- `universities` — listing/search
- `mentors` — discovery/search, eligibility filtering
- `sessions` — full booking lifecycle: request → accept/reject/cancel → (for calls) token issuance → dual-confirm connect → billing → extend → end
- `wallet` — balance, ledger, Razorpay topup (order + webhook + direct-confirm fallback), Uniminute conversion, holds
- `chat` — Stream Chat: session-scoped channels (CHAT-type sessions) + persistent support channel
- `agora` — RTC token generation (`RtcTokenBuilder.buildTokenWithUserAccount`)
- `reports` — user-submitted reports + admin resolution/manual refund

## What's NOT built yet

- `verification` — empty scaffold (mentor ID verification + admin review queue)
- `reviews` — empty scaffold (mentor/session reviews — note: distinct from the existing university `Review` model, which only covers colleges, not mentors)
- `notifications` — empty scaffold (push notifications; `Notification` Prisma model exists, Firebase config exists, no service/API built)
- Admin panel: only has a login screen — no actual admin UI for verification queue, user management, moderation, or the manual-refund report resolution flow (the API exists, `PATCH /reports/:id/resolve`, just no UI)
- **Mobile UI gaps:** no in-app call screens (outgoing/in-call/call-ended), no slot-picker on the booking flow (booking screen still only books `CHAT` type sessions — the backend fully supports `AUDIO_CALL` with slot selection, mobile just doesn't expose it yet), no "continue +5min" popup UI
- Payout automation: `PayoutRequest` is deliberately manual/admin-triggered only (architecture decision — no auto-payout). Agreed terms: 24–48hr processing window, ₹200 minimum withdrawal — not yet enforced in code.

## Design reference

A Figma file (Medconnect design) was reviewed screen-by-screen against the built app — the mobile UI is currently functional but styled with placeholder theme tokens, not the real design system. Key gaps identified from that review that aren't purely visual (i.e. imply schema/backend work, most now closed):
- Mentor profile detail screen (stats, reviews, expertise tags) — not built, needs the `reviews` module + aggregate stats
- Aspirant profile wizard (gender, state, city, qualification, stream, goals, etc.) — `UserProfile` schema doesn't have these fields yet
- Mentor profile wizard (college details, areas of guidance, mentoring preferences, ID verification with geo-tagged photo) — needs the `verification` module
- Wishlist/saved-mentors, saved-colleges — no favoriting model exists yet

## Conventions to follow

- Explicit allowlist response projections (`toXResponse()` functions) for every entity — never return a raw Prisma row, to avoid leaking fields like `phoneHash`/`realNameEncrypted` as the schema evolves.
- 404 (not 403) for resources a user isn't a party to, everywhere — avoids leaking resource existence to unrelated users.
- Idempotency keys on every ledger write (`applyLedgerEntry`), derived from a stable source (hold id, report id, Razorpay payment id) — retries must never double-apply.
- Every new module gets tested against the **real** running backend + real Supabase DB (not just `tsc` passing) before being considered done — create throwaway test users/sessions via a `node -e` script with the Prisma client, `curl` the actual endpoints, verify DB state, then clean up the test data.
