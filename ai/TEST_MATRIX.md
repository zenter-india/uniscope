# TEST MATRIX — UniScope

Structured, ID-addressable test cases for generic QA agents and human testers.

**Status legend**
`NOT_IMPLEMENTED` — no such test exists yet
`NOT_RUN` — defined here, never executed with recorded evidence
`PASS` / `FAIL` / `BLOCKED` — only ever set from a real
`ai/test-results/` record

**Every case below is currently `NOT_IMPLEMENTED` or `NOT_RUN`.** No case in
this repository has recorded passing evidence. Do not change a status without
attaching a result record.

**Field key**
`AUTOMATED_OR_MANUAL` — MANUAL, AUTOMATABLE (should be automated; is not yet),
or AUTOMATED
`DEVICE_REQUIREMENT` — NONE, ANDROID, IOS, EITHER, or DEVICE_A + DEVICE_B
`RISK_LEVEL` — per `RISK_RULES.md`

---

## AUTH — Authentication

### AUTH-001 · Request OTP
**Category** Auth · **Priority** P0 · **Risk** HIGH
**Preconditions** Backend running; `OTP_PROVIDER_TYPE` known
**Steps** `POST /auth/otp/request` with a valid phone
**Expected** 200 with a `serviceId`; OTP stored in Redis with TTL; no OTP in the response body
**Evidence** Response body; Redis key present
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTH-002 · Verify OTP and issue tokens
**Category** Auth · **Priority** P0 · **Risk** HIGH
**Preconditions** AUTH-001 completed
**Steps** `POST /auth/otp/verify` with the correct code and `serviceId`
**Expected** 200 with access+refresh tokens; user created or matched by `phoneHash`; OTP key deleted (one-time use)
**Evidence** Token pair; Redis key gone
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTH-003 · Reject wrong or expired OTP
**Priority** P0 · **Risk** HIGH
**Steps** Verify with a wrong code; then with an expired/unknown `serviceId`
**Expected** 401 both times; message does not distinguish "wrong" from "expired"
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTH-004 · OTP rate limiting
**Priority** P1 · **Risk** HIGH
**Steps** Request OTP 6 times within an hour for the same phone
**Expected** 6th returns 429
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTH-005 · Refresh token rotation
**Priority** P0 · **Risk** HIGH
**Steps** `POST /auth/token/refresh` with a valid refresh token
**Expected** New pair issued; role re-read from DB (stale role claims resolved)
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTH-006 · Banned user rejected immediately
**Priority** P0 · **Risk** HIGH
**Preconditions** Authenticated user with a valid, unexpired access token
**Steps** Set `isBanned = true`; immediately call any protected endpoint
**Expected** 401 on the very next request — no waiting out the token TTL (`JwtStrategy.validate` DB lookup)
**Evidence** Response before and after the ban
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTH-007 · No phone number in any response
**Priority** P0 · **Risk** HIGH
**Steps** Call `GET /users/me`, `GET /mentors`, `GET /mentors/:id`, `GET /sessions`
**Expected** No `phoneHash`, no raw phone, no `realNameEncrypted`, no decrypted real name anywhere
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTH-008 · Login on a real device
**Priority** P0 · **Risk** MEDIUM
**Steps** Fresh install → phone → receive SMS → enter code → role selection
**Expected** Reaches onboarding/home; tokens persisted in secure storage; survives app restart
**Evidence** Screenshots; restart still authenticated
**Automated/Manual** MANUAL · **Device** EITHER · **Status** NOT_RUN

---

## AUTHZ — Authorization

### AUTHZ-001 · Non-party session access returns 404
**Priority** P0 · **Risk** HIGH
**Steps** User C requests `GET /sessions/:id` for a session between A and B
**Expected** **404**, not 403 (deliberate convention — no existence leak)
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTHZ-002 · Non-admin blocked from admin routes
**Priority** P0 · **Risk** HIGH
**Steps** ASPIRANT token → `GET /enrollments`, `GET /users`, `PATCH /users/:id/ban`
**Expected** 403 on all
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTHZ-003 · Only the booked mentor may accept
**Priority** P0 · **Risk** HIGH
**Steps** A different mentor calls `POST /sessions/:id/accept`
**Expected** 404
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTHZ-004 · Only the aspirant may extend a call
**Priority** P1 · **Risk** HIGH
**Steps** Mentor calls `POST /sessions/:id/call/extend`
**Expected** 404/403; no ledger entry created
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### AUTHZ-005 · Call token only for session parties
**Priority** P0 · **Risk** HIGH
**Steps** Non-party requests `GET /sessions/:id/call/token`
**Expected** 404; no Agora token minted
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

---

## CALL — Audio calling

Full protocol, preconditions, and evidence requirements: **[CALL_TEST.md](CALL_TEST.md)**.
All require **DEVICE_A + DEVICE_B**, all are **HIGH** risk, all are **MANUAL**.

| ID | Case | Priority | Status |
|---|---|---|---|
| CALL-001 | Happy path: book → accept → connect → two-way audio → end → bill | P0 | NOT_RUN |
| CALL-002 | Slot overrun: extend +5 min / end / auto-end after 20s grace | P0 | NOT_RUN |
| CALL-003 | Mentor rejects — hold released, no billing | P0 | NOT_RUN |
| CALL-004 | No answer — 45s timeout, `NO_ANSWER`, hold released | P0 | NOT_RUN |
| CALL-005 | Receiver offline / app killed — expected: no ringing; caller times out | P0 | NOT_RUN |
| CALL-006 | Caller loses network mid-call | P1 | NOT_RUN |
| CALL-007 | Delayed notification (background / Doze / battery saver) | P1 | NOT_RUN |
| CALL-008 | Microphone permission denied — no join, no billing | P0 | NOT_RUN |
| CALL-009 | Notification permission denied | P1 | NOT_RUN |
| CALL-010 | App backgrounded mid-call — no foreground service / VoIP mode configured | P0 | NOT_RUN |
| CALL-011 | Network interruption mid-call (WiFi ↔ cellular) | P1 | NOT_RUN |
| CALL-012 | App killed and reopened mid-call — no recovery path | P1 | NOT_RUN |
| CALL-013 | Insufficient balance — booking rejected, no orphaned session | P0 | NOT_RUN |
| CALL-014 | Mentor unavailable / availability expired (>24h) | P0 | NOT_RUN |

### CALL-015 · Dual-confirm billing idempotency (backend only)
**Priority** P0 · **Risk** HIGH
**Preconditions** Session `ACCEPTED`, hold `ACTIVE`
**Steps** Call `POST /sessions/:id/call/joined` as **both** parties concurrently, then repeat each
**Expected** Exactly **one** transition to `IN_PROGRESS`; hold consumed exactly once; exactly one debit and one credit; repeats are no-ops
**Evidence** Ledger entries; hold status; session row
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED
> Highest-value untested logic in the codebase — it protects against double-charging and needs no devices.

### CALL-016 · Single-side join never bills
**Priority** P0 · **Risk** HIGH
**Steps** Only one party calls `/call/joined`; wait
**Expected** Session stays pre-`IN_PROGRESS`; **no** ledger entries; hold still `ACTIVE`
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### CALL-017 · Agora token scope
**Priority** P1 · **Risk** HIGH
**Steps** Obtain a token; inspect its channel and user-account binding
**Expected** Scoped to `call-<sessionId>` and the requesting user only; ~1h TTL; app certificate never returned
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

---

## WALLET — Wallet, billing, payouts

### WALLET-001 · Top-up credits the correct Uniminutes
**Priority** P0 · **Risk** HIGH
**Steps** Razorpay top-up (test mode) → webhook → ledger
**Expected** `TOPUP` ledger entry; balance increases by the converted amount; margin applied at conversion only and never shown as a line item
**Automated/Manual** MANUAL (payment) / AUTOMATABLE (webhook) · **Device** EITHER · **Status** NOT_RUN

### WALLET-002 · Ledger idempotency
**Priority** P0 · **Risk** HIGH
**Steps** Replay the same webhook / `applyLedgerEntry` with an identical idempotency key
**Expected** Exactly one ledger entry; balance unchanged on replay
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### WALLET-003 · Hold placed at booking
**Priority** P0 · **Risk** HIGH
**Steps** Book a paid audio call
**Expected** `WalletHold` `ACTIVE` for slot × rate; available balance reduced; `balanceMinor` not yet debited
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### WALLET-004 · Hold released on reject/cancel
**Priority** P0 · **Risk** HIGH
**Expected** Hold → `RELEASED`; available balance restored; no ledger entries
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### WALLET-005 · Mentor credit equals aspirant debit
**Priority** P0 · **Risk** HIGH
**Steps** Complete a paid call; compare the two ledger entries
**Expected** `|debit| == credit` exactly — no second margin at billing time
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### WALLET-006 · Insufficient balance leaves no orphaned session
**Priority** P0 · **Risk** HIGH
**Expected** Booking rejected **and** the session row deleted — the mentor must never see an unfunded request
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### WALLET-007 · Free tier consumed before paid
**Priority** P1 · **Risk** HIGH
**Expected** With sufficient free seconds: no hold, no ledger entries, `freeCallSecondsRemaining` decremented, clamped at ≥ 0
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### WALLET-008 · Extension billed exactly once
**Priority** P0 · **Risk** HIGH
**Steps** Extend a call; retry the same extension
**Expected** One debit and one credit per extension; `billedMinutes` +5; retry is a no-op (per-extension idempotency key)
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### WALLET-009 · Payout amount is derived, not supplied
**Priority** P0 · **Risk** HIGH
**Steps** Request a payout, including with a tampered client-supplied amount
**Expected** Amount computed from unpaid `SESSION_CREDIT` history; client value ignored; minimum enforced
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### WALLET-010 · Wallet debited only on payout COMPLETED
**Priority** P0 · **Risk** HIGH
**Expected** No debit on `PROCESSING`/`FAILED`; a single `PAYOUT` entry on `COMPLETED`
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### WALLET-011 · No rupee amounts on aspirant surfaces
**Priority** P1 · **Risk** MEDIUM
**Steps** Inspect mentor card, mentor detail, slot picker, in-call, session list, ledger
**Expected** Uniminutes only; ₹ appears **only** in the top-up sheet
**Automated/Manual** MANUAL · **Device** EITHER · **Status** NOT_RUN

---

## PUSH — Notifications

### PUSH-001 · Token registers after login
**Priority** P0 · **Risk** HIGH
**Steps** Fresh install → log in → wait
**Expected** `POST /users/me/push-token` succeeds; a `PushToken` row exists for the user with the right platform
**Evidence** `[push]` diagnostics in the run console; DB row
**Automated/Manual** MANUAL · **Device** EITHER · **Status** NOT_RUN

### PUSH-002 · Token refresh re-uploads
**Priority** P1 · **Risk** MEDIUM
**Expected** `onTokenRefresh` triggers a re-upload; `updatedAt` advances
**Automated/Manual** MANUAL · **Device** EITHER · **Status** NOT_RUN

### PUSH-003 · Stale token pruned
**Priority** P1 · **Risk** MEDIUM
**Steps** Send to a token Firebase reports unregistered
**Expected** Row deleted automatically; send does not throw
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### PUSH-004 · Session-accepted deep-link
**Priority** P0 · **Risk** HIGH
**Steps** Mentor accepts an audio call while the aspirant's app is backgrounded; aspirant taps the notification
**Expected** App opens directly on `/call/:sessionId`
**Automated/Manual** MANUAL · **Device** DEVICE_A + DEVICE_B · **Status** NOT_RUN

### PUSH-005 · Session-request does NOT deep-link (documents current behaviour)
**Priority** P1 · **Risk** MEDIUM
**Steps** Aspirant books; mentor taps the `SESSION_REQUEST` notification
**Expected — current design:** app opens normally, **not** into a call. Confirms the known limitation in `ARCHITECTURE.md`.
**Automated/Manual** MANUAL · **Device** DEVICE_A + DEVICE_B · **Status** NOT_RUN

### PUSH-006 · Push failure never blocks in-app notification
**Priority** P0 · **Risk** HIGH
**Steps** Trigger a notification with Firebase disabled/misconfigured
**Expected** Durable `Notification` row still created; API call still succeeds
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### PUSH-007 · No PII in push payloads
**Priority** P0 · **Risk** HIGH
**Expected** `data` carries only `{ type, sessionId, ... }`; no phone, real name, or token
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

---

## CHAT

### CHAT-001 · Chat session opens immediately
**Priority** P0 · **Risk** MEDIUM
**Expected** `POST /sessions` with `type: CHAT` → status `ACCEPTED` at once (no mentor accept step); Stream channel provisioned; `streamChannelId` persisted
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### CHAT-002 · Messages deliver both ways
**Priority** P0 · **Risk** MEDIUM
**Automated/Manual** MANUAL · **Device** DEVICE_A + DEVICE_B · **Status** NOT_RUN

### CHAT-003 · Support channel provisioned lazily
**Priority** P1 · **Risk** MEDIUM
**Steps** `GET /chat/support/token` for a user who has never used support
**Expected** Channel created on demand with the fixed support identity; token returned
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### CHAT-004 · Chat is never advertised as free
**Priority** P1 · **Risk** LOW
**Expected** No "Free chat" chip, no "Chat · Free" button, no "chatting is always free" copy anywhere
**Automated/Manual** MANUAL · **Device** EITHER · **Status** NOT_RUN

### CHAT-005 · Blocked users cannot start a chat
**Priority** P0 · **Risk** HIGH
**Expected** 404 (indistinguishable from mentor-not-found — no block-state leak)
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

---

## MENTOR — Availability and discovery

### MENTOR-001 · Availability gates calls only, never discovery
**Priority** P0 · **Risk** HIGH
**Expected** With availability OFF: mentor still listed and chat-reachable; **audio-call booking rejected** with the "still chat with them" message
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### MENTOR-002 · Availability auto-expires after TTL
**Priority** P0 · **Risk** HIGH
**Steps** Set `availabilitySetAt` older than `AVAILABILITY_TTL_HOURS`
**Expected** Every read path (list, detail, booking gate, mentor's own profile switch) reports **not** available, via `isCallAvailable()`
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### MENTOR-003 · Never labelled online/offline
**Priority** P1 · **Risk** MEDIUM
**Expected** UI reads "Accepting calls" / "Chat only" via `CallAvailabilityChip`; no presence dot; no "online"/"offline" copy anywhere
**Automated/Manual** MANUAL · **Device** EITHER · **Status** NOT_RUN

### MENTOR-004 · Ineligible mentors excluded
**Priority** P0 · **Risk** HIGH
**Expected** Unverified, inactive, banned, or blocked mentors are not bookable; 404 on direct id access
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

---

## VERIFY — Mentor verification

### VERIFY-001 · Document upload is private
**Priority** P0 · **Risk** HIGH
**Expected** Stored in a private bucket; `documentKey` never returned to any client; admin reads only via a short-lived signed URL
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### VERIFY-002 · Approval links university and unlocks discovery
**Priority** P1 · **Risk** MEDIUM
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

---

## PERM — Permissions

### PERM-001 · Microphone prompt (Android)
**Priority** P0 · **Risk** HIGH
**Expected** `uniscope/permissions#requestMicrophone` shows the OS dialog; grant → true, deny → false; denial state offers app settings
**Automated/Manual** MANUAL · **Device** ANDROID · **Status** NOT_RUN

### PERM-002 · Microphone prompt (iOS)
**Priority** P0 · **Risk** HIGH
**Expected** Same contract via `AVAudioSession`; `NSMicrophoneUsageDescription` string shown
**Automated/Manual** MANUAL · **Device** IOS · **Status** NOT_RUN

### PERM-003 · Notification permission (Android 13+)
**Priority** P0 · **Risk** MEDIUM
**Expected** Runtime `POST_NOTIFICATIONS` prompt appears (merged from the `firebase_messaging` manifest); grant → token registers
**Automated/Manual** MANUAL · **Device** ANDROID · **Status** NOT_RUN

### PERM-004 · Notification permission (iOS)
**Priority** P0 · **Risk** MEDIUM
**Expected** APNs prompt; token registers; `aps-environment` matches the build
**Automated/Manual** MANUAL · **Device** IOS · **Status** NOT_RUN

---

## BUILD — Build and packaging

### BUILD-001 · Android debug APK builds
**Priority** P0 · **Risk** HIGH
**Steps** `flutter build apk --debug`
**Expected** Succeeds; `unzip -l` shows **both** `libAgoraRtcWrapper.so` and `libagora-rtc-sdk.so` for all four ABIs (guards the vendored-AAR fix)
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_RUN

### BUILD-002 · Android release bundle signs
**Priority** P0 · **Risk** CRITICAL
**Preconditions** `key.properties` and keystore present
**Expected** `flutter build appbundle --release` succeeds and is signed with the release config, not debug
**Automated/Manual** MANUAL · **Device** NONE · **Status** NOT_RUN

### BUILD-003 · iOS build succeeds
**Priority** P0 · **Risk** HIGH
**Expected** Xcode build completes; entitlements match configuration
**Automated/Manual** MANUAL · **Device** NONE (macOS host) · **Status** NOT_RUN

### BUILD-004 · API_URL correctly baked in
**Priority** P0 · **Risk** HIGH
**Steps** Build with `--dart-define=API_URL=...`; observe the first network call
**Expected** Requests hit the intended backend, never `localhost`
**Automated/Manual** MANUAL · **Device** EITHER · **Status** NOT_RUN

### BUILD-005 · Backend type check and lint
**Priority** P0 · **Risk** MEDIUM
**Steps** `npx tsc -p tsconfig.build.json --noEmit`; `npm run lint --workspace=backend`
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED (as CI)

### BUILD-006 · Flutter analyze clean
**Priority** P0 · **Risk** MEDIUM
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED (as CI)

---

## RELEASE

### RELEASE-001 · Pre-release checklist complete
**Priority** P0 · **Risk** CRITICAL
**Expected** Every item in `QA.md` § Release QA satisfied, with evidence; human approval recorded
**Automated/Manual** MANUAL · **Device** DEVICE_A + DEVICE_B · **Status** NOT_RUN

### RELEASE-002 · Production OTP provider is NOT mock
**Priority** P0 · **Risk** CRITICAL
**Steps** Confirm `OTP_PROVIDER_TYPE` in the target environment
**Expected** `twilio`. If `mock`, **stop the release** — see `SECURITY.md` § S-1
**Automated/Manual** MANUAL · **Device** NONE · **Status** NOT_RUN

### RELEASE-003 · No secrets added
**Priority** P0 · **Risk** CRITICAL
**Steps** Review the diff; confirm no gitignored secret file became tracked
**Automated/Manual** AUTOMATABLE · **Device** NONE · **Status** NOT_IMPLEMENTED

### RELEASE-004 · Migrations applied cleanly
**Priority** P0 · **Risk** CRITICAL
**Expected** `migrate deploy` succeeds; no failed migration; destructive steps explicitly reviewed
**Automated/Manual** MANUAL · **Device** NONE · **Status** NOT_RUN

---

## Cross-cutting requirement summary

**Require DEVICE_A + DEVICE_B:** CALL-001…CALL-014, PUSH-004, PUSH-005, CHAT-002, RELEASE-001
**Require ANDROID specifically:** PERM-001, PERM-003, BUILD-001, BUILD-002
**Require IOS specifically:** PERM-002, PERM-004, BUILD-003
**Require NETWORK manipulation:** CALL-006, CALL-011
**Require BACKGROUND_STATE:** CALL-007, CALL-010, CALL-012, PUSH-004
**Require PAYMENT_STATE:** WALLET-001, WALLET-003, WALLET-005…WALLET-010, CALL-002, CALL-013

**Best automation candidates (no devices, highest risk):** CALL-015, CALL-016,
WALLET-002, WALLET-005, WALLET-006, WALLET-008, AUTH-006, AUTH-007,
AUTHZ-001…AUTHZ-005, MENTOR-002.
