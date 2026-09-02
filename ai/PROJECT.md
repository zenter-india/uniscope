# PROJECT — UniScope

## Project name

UniScope (repository/package name `uniscope`; Android application ID and iOS
bundle identifier `com.uniscope.uniscope_mobile`).

## Purpose

A mentorship marketplace that connects prospective students ("aspirants")
with verified current students and alumni ("mentors") at real colleges, for:

- **free text chat** with a mentor,
- **paid, fixed-slot audio calls** with a mentor,
- **honest college reviews** written by verified users.

The product thesis, stated in the public web copy: *"The best people to help
you choose a college are the people who are already studying there."*

Originally medical/dental-only; the product has since expanded to all
academic streams (Medical, Dental, Engineering, Arts & Humanities, Commerce &
Business, Law, Design, Others). See `CLAUDE.md` § Business model decisions.

## Platforms

| Surface | Location | Stack | Status |
|---|---|---|---|
| Android app | `mobile_flutter/` | Flutter | Implemented; release signing wired |
| iOS app | `mobile_flutter/` | Flutter | Implemented; APNs entitlements present |
| Backend API | `backend/` | NestJS + Prisma | Implemented, deployed |
| Admin panel | `admin/` | Next.js | Implemented; non-public surface |
| Public web | `web/` | Next.js | Implemented; enrollment lead capture |

Flutter web is used as a **development/preview convenience only** (see
`mobile_flutter/scripts/build_web.sh`). It is not a supported product
surface — notably, Agora audio calling does not work on Flutter web at all
(native-only plugin), and push registration is explicitly skipped on web
(`push_service.dart`, `if (kIsWeb) return`).

## Current status

Broadly feature-complete across the core marketplace loop, with one
significant unverified area (audio calling on real devices) and effectively
no automated test or CI coverage.

**Implemented and exercised against real services:**

- Phone-OTP authentication with JWT access/refresh
- Role selection and role-specific onboarding wizards
- Mentor discovery, mentor detail, mentor reviews
- College (university) discovery, detail, reviews, saved colleges
- Session lifecycle: request → accept/reject/cancel → connect → bill → end
- Free chat via Postgres + Supabase Realtime Broadcast (session-scoped channels + a persistent support channel; replaced Stream Chat 2026-09-02 — see `CLAUDE.md`'s "Chat architecture" section)
- Paid audio calls via Agora (fixed 5/10/20-minute pre-paid slots)
- Uniminutes wallet: Razorpay top-up, ledger, holds, mentor payouts
- Mentor identity verification with admin review queue
- Reports and admin moderation, including manual refunds
- In-app notifications (durable) + best-effort FCM push
- Admin panel: dashboard, verification, moderation, users, universities, data import
- Public enrollment microsite capturing pre-account leads

**Known incomplete or unverified — see `ARCHITECTURE.md` and `QA.md`:**

- Two-device audio call has **never been verified end-to-end on real
  hardware**. Do not assert that it works.
- No CI/CD pipeline exists (`.github/` contains only issue and PR templates).
- No crash/error-reporting SDK on mobile or backend.
- Automated test coverage is near-zero relative to feature surface.

## User roles

Defined by the `UserRole` enum in `backend/prisma/schema.prisma`:

| Role | Meaning |
|---|---|
| `ASPIRANT` | Prospective student seeking guidance. Books chats and calls, spends Uniminutes. |
| `MENTOR` | Verified current student or alumnus. Accepts sessions, earns per call minute, requests payouts. |
| `ADMIN` | Internal staff. Verification review, moderation, refunds, user/university management, data import. Uses the separate admin panel, not the mobile app. |

Collapsed from four earlier granular roles via a data-preserving migration —
see `CLAUDE.md` and `prisma/migrations/*_collapse_user_role_to_aspirant_mentor/`.

## Major user journeys

**Aspirant**
1. Welcome → phone OTP login → role selection → aspirant onboarding wizard
   (location, academics, preferences) → Home.
2. Browse mentors / colleges → open mentor detail → start a **free chat**
   (opens immediately, no mentor accept step).
3. Request a **paid audio call**: pick a fixed slot (5/10/20 min) → wallet
   balance checked and a hold placed **at booking time** → wait for mentor
   accept → both join → call.
4. Top up the Uniminutes wallet via Razorpay when balance is short.
5. Review a mentor after a session; review a college (verified users only).
6. Report a user or session; an admin may issue a manual refund.

**Mentor**
1. Welcome → phone OTP login → role selection → mentor onboarding wizard
   (name + self-chosen alias, location, college details, current status) →
   identity verification (college ID upload) → Home.
2. Toggle "Accepting call bookings" (`isMentorAvailable`, auto-expires after
   24h — see `ARCHITECTURE.md`).
3. See incoming session requests, accept or reject.
4. Chat and take audio calls; earn a flat rate per call minute.
5. Request a payout once unpaid earnings exceed the minimum.

**Admin** (admin panel, `admin/`)
1. Log in with the single hardcoded admin credential set.
2. Review the mentor verification queue with signed document previews.
3. Resolve reports; optionally issue a refund.
4. Search/filter/ban users; manage universities; run data imports.

## Major screens and modules

Mobile routes (`mobile_flutter/lib/router/app_router.dart`):

```
/welcome  /login  /otp                      auth
/role-selection  /profile-setup             post-signup
/aspirant-onboarding  /mentor-onboarding    role wizards
/home  /dashboard                           role-aware landing
/mentors  /mentors/:id  /mentors/saved      discovery
/colleges  /colleges/:id  /colleges/saved   discovery
/chats  /chats/room  /chats/support         messaging
/call/:sessionId                            audio call (outside nav shell)
/wallet                                     Uniminutes / earnings
/profile  /profile/edit  /profile/avatar    profile
/profile/settings  /profile/blocked-users
/verification                               mentor ID submission
/notifications
/admin/*                                    in-app admin (limited)
```

Backend modules (`backend/src/modules/`):

```
users  mentors  universities  university-reviews  university-wishlist
sessions  chat  agora  wallet  payouts  reviews  wishlist
verification  reports  blocks  notifications  avatar
enrollments  data-import
```

Plus cross-cutting: `auth/`, `common/`, `config/`, `database/`, `firebase/`,
`redis/`, `supabase/`, `health/`.

## Major backend interactions

The mobile app talks to a single REST API (`API_PREFIX=api/v1`) over Dio,
with a JWT access token attached per request and a silent refresh-and-retry
interceptor on `401` (`mobile_flutter/lib/core/network/dio_client.dart`).

Notable non-REST interactions:

- **Chat (Postgres + Supabase Realtime)**: message send/read proxies fully
  through the API (unlike the other two items here) — the backend persists
  every message and is the only path that can read one. The mobile app
  additionally connects directly to Supabase Realtime with a public anon
  key, but only to receive a content-free "new message" ping on a private
  topic; it never carries message text. See `CLAUDE.md`'s "Chat
  architecture" section.
- **Agora RTC**: the mobile app joins an Agora channel directly using a
  short-lived token minted by the backend; media never transits the API.
- **Razorpay**: checkout runs in the Razorpay SDK on-device; the backend
  reconciles via webhook, with a direct client-confirm fallback for local
  development where webhooks cannot reach localhost.

## Major external services

| Service | Used for | Integration point |
|---|---|---|
| Supabase (PostgreSQL) | Primary database | Prisma via `DATABASE_URL` / `DIRECT_URL` |
| Supabase Storage | Verification docs, avatars, university and web assets | `backend/src/supabase/` |
| Twilio Verify | Phone OTP delivery | `auth/otp/twilio-otp.provider.ts` |
| Supabase Realtime | Text chat live-delivery signal (persistence is Postgres via Prisma, same DB row above) | `modules/chat/` |
| Agora | Audio call transport + RTC tokens | `modules/agora/` |
| Razorpay | Wallet top-up payments | `modules/wallet/` |
| Firebase Cloud Messaging | Push notifications | `firebase/`, `modules/notifications/` |
| Upstash Redis | OTP state, rate limiting | `redis/` |
| Railway | Backend hosting (production) | `uniscope-production.up.railway.app` |
| Vercel | `web/` hosting (production `uniscope.in`) | Git-integrated |

## Important business rules

These are **locked-in product decisions**. Do not re-litigate them without
explicit human approval; several were reversed once already and re-reversing
them silently is a real risk. Authoritative source: `CLAUDE.md` § Business
model decisions.

1. **Currency is "Uniminutes."** 1 Uniminute = 1 minute of call time =
   1000 minor units = ₹10. Money is always stored as **integer minor units**,
   never floats.
2. **Uniminutes are the only aspirant-facing unit.** Rupees appear *only* at
   wallet top-up. Never express call cost in ₹ on an aspirant surface.
   Mentor-facing earnings/payout surfaces stay in ₹ (they withdraw to a bank).
3. **Flat mentor rate.** Every mentor currently earns the same rate per call
   minute (`MENTOR_RATE_PER_MINUTE_MINOR`). There is deliberately **no
   per-mentor call rate field**, even though the Figma design shows one.
4. **Recharge margin is invisible.** The margin is baked into the top-up
   conversion only; it is never shown as a line item, and never taken again
   at session-billing time — the mentor is credited exactly what the aspirant
   was debited.
5. **Chat is free, and is never advertised as free.** No "Free chat" chips or
   "chat is always free" copy. The button says "Chat".
6. **Availability is stated intent, not presence.** `isMentorAvailable` is a
   mentor's own "accepting call bookings" switch. It gates **only** audio-call
   booking; it never hides a mentor from discovery. It must never be labelled
   "online"/"offline". It auto-expires after `AVAILABILITY_TTL_HOURS` so a
   forgotten toggle cannot advertise a stale promise. Every read path must go
   through `isCallAvailable()` in `modules/mentors/availability.ts`.
7. **Audio calls are fixed pre-paid slots** (5/10/20 min), not live per-minute
   metering. Balance is checked and a `WalletHold` placed **at booking time**,
   before the mentor ever sees the request.
8. **Free tier**: 2 free chat sessions and 10 free call minutes per aspirant.
9. **Call connect requires dual confirmation.** Billing only fires once both
   parties' clients independently report joining. Neither party alone can
   trigger a charge. This is an interim fraud-resistance measure standing in
   for a real Agora server-side webhook.
10. **Call overrun is a hard cutoff** with a "continue?" prompt offering one
    more fixed +5-minute block, billed the same way.
11. **A mentor-side call drop still bills the aspirant in full** — never an
    automatic refund. The aspirant gets a Report action; an admin reviews and
    may issue a `REFUND` ledger entry manually.
12. **Payout amounts are always derived** from unpaid `SESSION_CREDIT` ledger
    history, never mentor-chosen. Minimum payout enforced. The wallet is only
    debited on `COMPLETED`. There is deliberately **no auto-disbursement**.
13. **Non-destructive data model.** There is no delete endpoint for users or
    universities by design — deactivate/ban is the only removal path.

## Important integrations and conventions

- **Explicit allowlist response projections** (`toXResponse()`) for every
  entity. Never return a raw Prisma row — this is what keeps `phoneHash` and
  `realNameEncrypted` from leaking as the schema evolves.
- **404, not 403**, for resources a user is not a party to, everywhere. This
  avoids leaking resource existence to unrelated users.
- **Idempotency keys on every ledger write** (`applyLedgerEntry`), derived
  from a stable source (hold id, report id, Razorpay payment id). Retries must
  never double-apply.
- **Real names are encrypted at rest** (`UserProfile.realNameEncrypted`,
  AES-256-GCM). Never returned in any response projection; write-only via DTO.
  Only the self-chosen alias (`User.displayName`) is ever public.
- **Ban enforcement is a per-request DB lookup** in `JwtStrategy.validate()`,
  a deliberate stateless→lookup tradeoff so a ban takes effect immediately
  rather than waiting out the access-token TTL.

## Explicitly unknown

- **Product analytics**: no analytics SDK found in the mobile app or backend.
  Whether product analytics is expected — UNKNOWN — HUMAN INPUT REQUIRED.
- **Video calling**: no video-call implementation exists. Agora is initialised
  audio-only (`enableAudio()`, no video engine calls). Whether video is
  planned — UNKNOWN — HUMAN INPUT REQUIRED.
- **Formal staging environment**: no staging backend or staging Firebase
  project was found. See `RELEASE.md`.
