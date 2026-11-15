# SECURITY — UniScope

Security-sensitive surfaces of this project, the classification of the data
they handle, and the actions an AI agent must never take autonomously.

**This document contains no secret values.** It names variables and locations
only. Never paste an actual secret into this file, a commit, a log, a test
record, or a chat message.

---

## Data classification

### SAFE — may appear in code, docs, logs, and commits

- Public identifiers: user id (UUID), session id, university id/slug
- `User.displayName` (the self-chosen public alias)
- Mentor public profile: alias, stream, degree, college, languages, bio,
  rating, review count
- University catalogue data (name, type, state, city, public photo URL)
- Enum values, status strings, `endReason` codes
- Uniminute amounts and slot lengths shown in the UI
- Non-secret configuration: `NODE_ENV`, `PORT`, `API_PREFIX`, `APP_NAME`
- Public API base URLs and `.vercel.app` / Railway hostnames
- Firebase **project id** (`uniscope-83eeb`) and Supabase project ref —
  these appear in committed config and are not secrets on their own

### SENSITIVE — handle carefully; never log; restrict in responses

- **Phone numbers.** Stored only as `phoneHash` (SHA-256) on `User`.
  The one deliberate exception is `EnrollmentLead.phone`, stored in
  **plaintext** because an uncontactable marketing lead is worthless. That
  exception is documented in code and must not be extended to `User`.
- **Real names.** `UserProfile.realNameEncrypted` (AES-256-GCM). **Never**
  returned by any response projection; write-only via DTO. Only the alias is
  public.
- Email addresses (enrollment leads, admin)
- Date of birth, gender, precise location (state/city)
- Wallet balances, ledger entries, hold records, payout requests
- Session history: who spoke to whom, when, for how long, at what cost
- Chat message content (held by Stream Chat)
- Verification documents — college ID photos in a **private** Supabase
  Storage bucket, readable only via short-lived signed URLs
- Report contents and moderation notes
- FCM device tokens (`PushToken.token`)
- Agora RTC tokens, Stream Chat user tokens (short-lived, per-user, per-channel)
- Internal user ids when correlated with any of the above

### SECRET — never commit, never log, never print, never place in a test record

Environment variables (values live only in `backend/.env`, Railway, Vercel,
and local files):

| Variable | Guards |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Full database access |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses all row-level security |
| `SUPABASE_ANON_KEY` | Client-scoped Supabase access |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Forge any user session |
| `PROFILE_ENCRYPTION_KEY` | Decrypt every stored real name |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Send SMS / incur cost |
| `STREAM_API_KEY`, `STREAM_API_SECRET` | Impersonate any chat user |
| `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | Mint call tokens for any channel |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payments; forge webhooks |
| `FIREBASE_SERVICE_ACCOUNT_KEY_*` | Push to every device; Firebase admin |
| `REDIS_URL` | OTP state, rate-limit state |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Full admin panel access |

Files:

| File | Status |
|---|---|
| `backend/.env`, `admin/.env.local`, `web/.env.local` | gitignored |
| `backend/firebase-service-account.json` | gitignored |
| `mobile_flutter/android/key.properties` | gitignored |
| `mobile_flutter/android/app/upload-keystore.jks`, `*.jks` | gitignored |
| `mobile_flutter/android/app/google-services.json` | gitignored |

---

## Security-sensitive areas

**Authentication** — Phone OTP → JWT access/refresh. Two providers behind one
interface, selected by `OTP_PROVIDER_TYPE`. Phone stored as SHA-256 hash only.
OTP state in Redis with TTL and one-time use; rate limited to 5/hour per phone
hash.

**Authorization** — `JwtAuthGuard` globally on protected controllers;
`RolesGuard` + `@Roles(UserRole.ADMIN)` for admin routes. Session routes
verify the caller is a party. Convention: **404, not 403**, for non-party
access, so resource existence is not leaked. `JwtStrategy.validate()` does a
per-request DB lookup and rejects banned/inactive/deleted users immediately —
a ban takes effect without waiting out the token TTL.

**User data** — Protected by explicit allowlist response projections
(`toXResponse()`), never raw Prisma rows. This is the mechanism that keeps
`phoneHash` and `realNameEncrypted` out of responses as the schema evolves.

**Database access** — Prisma via pooled `DATABASE_URL` at runtime; `DIRECT_URL`
for migrations only. The Supabase **service-role key** bypasses row-level
security and must never reach a client.

**Wallet and transactions** — Integer minor units only. Every ledger write is
idempotency-keyed from a stable source, so retries cannot double-apply. Holds
gate spending at booking time. Mentor credit always equals aspirant debit — no
second margin at billing time. Payout amounts are **derived**, never
client-supplied, and there is no auto-disbursement.

**Payments** — Razorpay webhook HMAC is verified against the **raw** request
body (`rawBody: true` in `main.ts`) before JSON parsing. The direct
client-confirm fallback exists for local development only; it must never
become the primary reconciliation path in production.

**Calling** — Agora tokens are minted server-side, scoped to a single channel
and a single user account, role `PUBLISHER`, 1-hour TTL. The app certificate
never leaves the backend. Only session parties can obtain a token
(`requireSessionForParty`). Billing requires **both** parties to confirm join,
so neither side alone can trigger a charge.

**Notifications** — FCM data payloads carry `{ type, sessionId, ... }` only;
no PII, no tokens. Device tokens are stored server-side and pruned when
Firebase reports them invalid.

**Mobile configuration** — `API_URL` is a compile-time `--dart-define`. No
secrets are compiled into the app: Agora and Stream tokens are fetched at
runtime, and the Razorpay **key id** (publishable) is the only payment
identifier the client sees.

**Logs** — Backend uses NestJS `Logger`. Notable: the **mock** OTP provider
does `console.log('[OTP Mock] <phone>: <code>')`, printing a real phone number
and code — acceptable locally, unacceptable in any shared environment (another
reason mock mode must never run remotely). The temporary `[push]` diagnostics
in `push_service.dart` deliberately log no token, header, or secret values.

**Analytics** — none present.

**Third-party services** — Supabase, Twilio, Stream, Agora, Razorpay, Firebase,
Upstash Redis, Railway, Vercel. Each holds credentials listed under SECRET.

---

## Findings

### S-1 — `render.yaml` pins mock OTP under production (HIGH)

`render.yaml` (committed at the repository root) declares a production service
(`NODE_ENV: production`) and sets:

```yaml
- key: OTP_PROVIDER_TYPE
  value: mock          # literal value, not a synced secret
```

In mock mode, `MOCK_OTP_FIXED_CODE = '111111'` is accepted for **any** phone
number. Anyone who can reach such a deployment can authenticate as any user,
including a user who is an `ADMIN`. Rate limiting (5/hour) does not mitigate
this meaningfully.

Current production is Railway, not Render, and Railway's variable **values are
not readable** through the connected integration — so the live value is
**UNKNOWN — HUMAN INPUT REQUIRED**. `CLAUDE.md` already warns "don't ship this
backend reachable outside localhost while in mock mode"; `render.yaml`
contradicts that warning in committed form.

**Required human actions**
1. Verify `OTP_PROVIDER_TYPE` on Railway production is `twilio`, not `mock`.
2. Decide whether Render is still used. If it is, change this value. If it is
   not, delete `render.yaml` so it cannot be applied by mistake.
3. If mock mode was ever live on a reachable host, treat all accounts created
   in that window as untrusted.

### S-2 — iOS Firebase plist is committed, Android's is not (LOW/INFO)

`mobile_flutter/ios/Runner/GoogleService-Info.plist` is **tracked in git**
(added in commit `08fd85b`), while the Android equivalent
`google-services.json` is gitignored.

The plist contains `API_KEY`, `GCM_SENDER_ID`, `GOOGLE_APP_ID`, `PROJECT_ID`,
`BUNDLE_ID`, `STORAGE_BUCKET` — client-side Firebase identifiers that are
extractable from any shipped app binary. Per Google's guidance these are not
secrets; the real boundary is Firebase Security Rules and App Check.

So this is **an inconsistency to resolve deliberately, not an active breach**.
Decide one policy and apply it to both platforms.
**Human decision required** — UNKNOWN — HUMAN INPUT REQUIRED.

### S-3 — No server-side verification of call connection (MEDIUM)

Billing settles on two **client** self-reports (`POST /call/joined`), not on
any server-observed media event. The dual-confirm design means neither party
alone can trigger a charge, which blunts the obvious abuse. But a modified
client could still confirm a join that never produced audio.

`CLAUDE.md` records this as a deliberate interim measure pending an Agora
server-side "user joined channel" webhook that was never configured.

**Human action** — configure the Agora webhook, or accept the residual risk
explicitly.

### S-4 — No audit trail for admin actions (MEDIUM)

Admins can ban users, resolve reports, issue manual `REFUND` ledger entries,
and edit universities. Refunds leave a ledger row, but there is no dedicated,
tamper-evident admin audit log recording who did what and when.

**Human action** — decide whether an audit log is required before wider admin
access is granted.

### S-5 — No crash or error reporting (MEDIUM, operational)

No Sentry/Crashlytics/Bugsnag anywhere. A production authentication, payment,
or call failure produces no alert and, on mobile, no trace at all. This is
also the principal reason the audio-call issue is hard to diagnose
(`ARCHITECTURE.md` § Diagnosability gaps).

---

## Actions AI agents must NEVER perform autonomously

Each of these is CRITICAL in `RISK_RULES.md` and requires specific, named
human authorization. A general "go ahead" on a task never covers them.

1. **Disabling or weakening authentication** — including removing a guard,
   widening a public route, or setting `OTP_PROVIDER_TYPE=mock` anywhere
   reachable outside localhost.
2. **Bypassing authorization** — removing a session-party check, widening an
   admin route, replacing 404-for-non-party with 403, or returning a raw
   Prisma row instead of a projection.
3. **Exposing user data** — adding `phoneHash`, `realNameEncrypted`, a
   decrypted real name, a raw phone number, a device token, or a storage key
   to any response, log, test record, or commit.
4. **Changing production credentials** — rotating, replacing, or printing any
   value in the SECRET table.
5. **Destructive production database changes** — deleting or truncating data,
   dropping columns/tables with live data, or running an enum remap without a
   data-preserving `USING` clause.
6. **Modifying payment security** — Razorpay webhook signature verification,
   idempotency key derivation, hold-consumption logic, or the mentor-credit
   equals aspirant-debit invariant.
7. **Changing production signing credentials** — Android keystore or
   `key.properties`, iOS certificates, provisioning profiles, or entitlements.
8. **Publishing a release** to Play Store, App Store, internal testing, or
   TestFlight.
9. **Committing any gitignored secret file**, or removing an entry from
   `.gitignore` that currently protects one.
10. **Disabling rate limiting, throttling, or validation pipes** to make a
    test or build pass.

---

## If a secret is exposed

1. Stop. Do not commit, push, or continue the task.
2. Do not paste the value anywhere else, including into an explanation.
3. Report the exposure and its location to a human immediately.
4. Rotation is a **human** action — see item 4 above.
5. If it reached git history, note that removing the file in a later commit
   does **not** remove it from history; say so explicitly.
