# ARCHITECTURE — UniScope (as actually built)

This document describes what UniScope **actually uses**, verified against
source. It does not propose replacements. Where repository documentation
disagrees with the code, the code is treated as authoritative and the
discrepancy is recorded under § Documentation drift.

Verified: 2026-08-13.

---

## Repository layout

```
uniscope/                    npm workspaces monorepo
├── backend/                 NestJS 11 API + Prisma 7          [workspace]
├── admin/                   Next.js admin panel               [workspace]
├── web/                     Next.js public enrollment site    [workspace]
├── mobile_flutter/          Flutter app (NOT an npm workspace)
├── docs/                    architecture / ADRs / standards
├── infrastructure/          docker-compose (local), deployment placeholder
├── ai/                      this context package
├── render.yaml              Render service descriptor (see § Infrastructure)
├── CLAUDE.md / AGENTS.md    long-form project history (near-duplicates)
└── package.json             workspaces: backend, admin, web
```

Root scripts: `dev:backend`, `dev:admin`, `dev:web`, `build`, `lint`, `test`,
`format`. Engines: Node >= 20, npm >= 10.

---

## MOBILE

**Framework** — Flutter, Dart SDK constraint `^3.12.2`. Verified toolchain at
time of writing: Flutter 3.44.4 / Dart 3.12.2.

**Language** — Dart, plus Kotlin (Android host) and Swift (iOS host).

**State management** — `flutter_riverpod` ^3.3.2. Providers are declared
adjacent to the code they serve (for example `sessionsApiProvider` in
`core/network/sessions_api.dart`, `authControllerProvider` in
`state/auth_controller.dart`). There is no central provider registry.

**Navigation** — `go_router` ^17.3.0, configured in
`lib/router/app_router.dart`. A `rootNavigatorKey` `GlobalKey<NavigatorState>`
is exported specifically so code with no `BuildContext` — the FCM push
handlers — can navigate. Redirect logic keeps users inside the pre-auth route
set (`/welcome`, `/login`, `/otp`) until authenticated, and inside the
onboarding route set while `AuthState.needsOnboarding` is true.

**HTTP** — `dio` ^5.10.0. `lib/core/network/dio_client.dart` defines
`kApiBaseUrl` as a **compile-time constant**:

```dart
const String kApiBaseUrl = String.fromEnvironment(
  'API_URL', defaultValue: 'http://localhost:3001/api/v1');
```

This is baked in at build time via `--dart-define=API_URL=...`. A build
produced without that flag targets `localhost`, which is meaningless on a
physical device or emulator. The Dio interceptor attaches the access token
per request and, on `401`, performs a single silent refresh-and-retry using a
separate `Dio` instance (so the interceptor cannot recurse) before logging out.

**Secure storage** — `flutter_secure_storage` ^10.3.1 for the token pair.

**Major mobile modules** (`lib/features/`):
`auth`, `home`, `mentors`, `universities`, `sessions`, `calls`, `wallet`,
`profile`, `verification`, `notifications`, `reports`, `admin`, `shell`,
`common`.

---

## ANDROID

**Native integrations**
- `MainActivity.kt` implements a hand-rolled `MethodChannel`
  (`uniscope/permissions`) exposing `requestMicrophone` and `openAppSettings`.
  This deliberately bypasses the `permission_handler` plugin, which never
  binds on this project's AGP 9 / Kotlin 2.3 toolchain (registers without
  error, then throws `MissingPluginException` on every Dart call).
- Firebase via `google-services.json` (gitignored).
- Agora RTC via `agora_rtc_engine` 6.5.4 plus a **vendored, patched AAR**.

**Permissions declared** (`AndroidManifest.xml`):
`INTERNET`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH`,
`BLUETOOTH_CONNECT`.
`POST_NOTIFICATIONS` is **not** declared here — it is merged in
automatically from the `firebase_messaging` plugin's own manifest, and the
runtime prompt is triggered by that plugin's native code when
`FirebaseMessaging.requestPermission()` is called from Dart.

**Build structure** — `compileSdk = 36` (raised because `agora_rtc_engine`'s
transitive AndroidX dependencies require it; `flutter.compileSdkVersion` at 31
is too old). Java/Kotlin target 17. Root `build.gradle.kts` sets
`rootProject.extra["compileSdkVersion"] = 36` before subprojects evaluate,
because `agora_rtc_engine`'s own Gradle file reads it and otherwise falls back
to 31.

**The vendored Agora AAR (important, load-bearing)** —
`android/app/libs/iris-rtc-patched.aar`. Both `io.agora.rtc:iris-rtc` and
`io.agora.rtc:agora-special-full` ship an `AndroidManifest.xml` declaring
`package="io.agora.rtc"`, which AGP 8.3+/9.x hard-fails on. An earlier
workaround excluded `iris-rtc` entirely, which built successfully but dropped
its JNI wrapper (`libAgoraRtcWrapper.so`) and crashed "Join Call" with
`UnsatisfiedLinkError`. The current fix vendors a copy of the AAR with its
manifest package rewritten to `io.agora.rtc.iris` and excludes only the
unpatched upstream module. Both AARs are pure native-lib containers (empty
`classes.jar`), so the `package` attribute is inert at runtime. See
`android/app/libs/README.md` for regeneration steps.
**Do not "clean up" this exclusion or the vendored AAR** — it is the fix.

**Signing** — `android/key.properties` (gitignored) supplies `storeFile`,
`storePassword`, `keyAlias`, `keyPassword`. `build.gradle.kts` conditionally
creates the `release` signing config only when that file exists, and falls
back to debug signing when absent, so a fresh checkout still builds (but the
artifact is not uploadable).

---

## iOS

**Native integrations**
- `AppDelegate.swift` implements the **iOS counterpart** of the same
  `uniscope/permissions` channel (`requestMicrophone` via `AVAudioSession`,
  `openAppSettings`). Contract matches Android exactly.
- Firebase via `GoogleService-Info.plist`.
- Agora via the `agora_rtc_engine` CocoaPods/SPM dependency.

**Permissions declared** (`Info.plist`): `NSMicrophoneUsageDescription`,
`NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription`,
`NSLocationWhenInUseUsageDescription`.
`UIBackgroundModes` includes `remote-notification`.

**Entitlements** — `Runner.entitlements` (`aps-environment: development`) and
`Runner-Release.entitlements` (`aps-environment: production`), wired via
`CODE_SIGN_ENTITLEMENTS` across build configurations.

**Build structure** — standard Flutter iOS host. Three plugins do not support
Swift Package Manager and fall back to CocoaPods: `get_thumbnail_video`,
`media_kit_video`, `razorpay_flutter`.

**Signing** — Xcode-managed. Specific team/profile configuration is
TODO — HUMAN INPUT REQUIRED (see `RELEASE.md`).

---

## BACKEND

**Framework** — NestJS 11, TypeScript 5.7, ESM (`.js` import specifiers).

**Bootstrap** (`src/main.ts`)
- `rawBody: true` — required to verify the Razorpay webhook HMAC against the
  exact signed bytes, before the JSON body parser can re-serialize them.
- JSON body limit raised to `10mb` — verification documents are sent as
  base64 in the JSON body (simpler than multipart from Dio); a ~5MB image is
  ~6.7MB base64.
- Global prefix `api/v1`, with `health` excluded so infra liveness probes can
  hit `/health` at the root.
- CORS `origin: true, credentials: true`.
- Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`,
  `transform`, and implicit conversion.

**Authentication**
- Phone OTP → JWT access/refresh pair. `passport-jwt` strategy.
- Two OTP providers behind one interface (`auth/otp/otp-provider.interface.ts`),
  selected by `OTP_PROVIDER_TYPE`: `twilio` (Twilio Verify) or `mock`.
- **Mock provider uses a fixed code `111111` for any phone number**
  (`MOCK_OTP_FIXED_CODE`). It is rate-limited (5/hour per phone hash, Redis)
  but is otherwise a universal login. See `SECURITY.md` — this is the single
  most dangerous configuration switch in the system.
- Phone numbers are stored **only** as a SHA-256 hash (`phoneHash`) on `User`.
- `JwtStrategy.validate()` performs a **per-request database lookup** and
  rejects immediately if `isBanned` / `!isActive` / `deletedAt` is set. This
  is a deliberate stateless→lookup tradeoff so bans take effect instantly.
- `RolesGuard` + `@Roles(UserRole.ADMIN)` gate admin routes.
- Rate limiting: `@nestjs/throttler` globally, with tighter per-route
  `@Throttle` on the public enrollment endpoints.

**Database** — PostgreSQL on Supabase, accessed through Prisma 7 with the
`@prisma/adapter-pg` driver adapter.
- `DATABASE_URL` → pgBouncer transaction pooler (port 6543), used at runtime.
- `DIRECT_URL` → direct connection (port 5432), used by the Prisma CLI for
  migrations (pgBouncer cannot run schema migrations).
- Prisma 7 syntax: **no `url` in the `datasource` block** — it is read from
  `prisma.config.ts`.
- 25 migrations applied. `prisma migrate dev` and `migrate reset` require a
  TTY and do not work in non-interactive agent sessions; use
  `migrate diff` + hand-created migration folder + `migrate deploy`.

**Domain models** (`prisma/schema.prisma`, 26 models / 18 enums) — principal:
`User`, `UserProfile`, `University`, `Program`, `VerificationRequest`,
`Review` (university-scoped), `MentorReview`, `SavedMentor`, `SavedUniversity`,
`BlockedUser`, `Session`, `Wallet`, `LedgerEntry`, `WalletHold`,
`PayoutRequest`, `Report`, `Notification`, `PushToken`, `DataImportJob`,
`EnrollmentLead`.

**Storage** — Supabase Storage buckets for verification documents (private,
read via short-lived signed URLs), avatars, university photos, and public web
assets.

**Modules** — `users`, `mentors`, `universities`, `university-reviews`,
`university-wishlist`, `wishlist`, `sessions`, `chat`, `agora`, `wallet`,
`payouts`, `reviews`, `verification`, `reports`, `blocks`, `notifications`,
`avatar`, `enrollments`, `data-import`.

---

## REAL-TIME

### Chat

**Provider** — Stream Chat (`stream-chat` server SDK; `stream_chat_flutter`
^9.5.0 client).

**Purpose** — free text messaging between an aspirant and a mentor, plus a
persistent support channel.

**Entry point** — `modules/chat/`; mobile connects directly to Stream using a
backend-minted token.

**Data flow** — CHAT sessions **open immediately** on `create()` (status set
straight to `ACCEPTED`, no mentor accept step) and a Stream channel is
provisioned via `ensureChannelForSession`. A separate persistent
"UniScope Support" channel per user is lazily provisioned via
`GET /chat/support/token`.

**Failure modes** — Stream outage breaks messaging entirely (no fallback
transport). A failed channel provision surfaces as a failed session create.

> Stream Chat's own "last seen" indicator in the chat header is a genuine
> vendor-provided presence signal. It is **not** the same thing as
> `isMentorAvailable`, and the two must never be conflated in UI copy.

### Audio calling

**Provider** — Agora RTC (`agora_rtc_engine` 6.5.4 client; `agora-token`
server SDK for token minting).

**Model** — **request/accept, not ringing.** There is no incoming-call screen,
no CallKit/ConnectionService integration, and no VoIP push. This is the single
most important architectural fact about calling in UniScope.

**Entry points**
- Backend: `SessionsController` — `POST /sessions`, `POST /sessions/:id/accept`,
  `GET /sessions/:id/call/token`, `POST /sessions/:id/call/joined`,
  `POST /sessions/:id/call/extend`, `POST /sessions/:id/call/end`.
- Mobile: `features/calls/call_screen.dart` (a single 614-line state machine),
  reached from `/call/:sessionId`.

**Data flow — the full sequence, as implemented**

1. **Initiate.** Aspirant calls `POST /sessions` with
   `{ mentorId, type: AUDIO_CALL, slotMinutes }`.
   `SessionsService.create()` checks: not self-booking; not blocked in either
   direction; mentor eligible (`mentorsService.findById`); **mentor
   `isAvailable`** (expiry-aware); no existing active session of the same type.
2. **Reserve funds.** If the aspirant's remaining free call seconds do not
   cover the slot, a `WalletHold` is placed for
   `slotMinutes × MENTOR_RATE_PER_MINUTE_MINOR`. If the hold fails
   (insufficient balance), the just-created session row is **deleted** rather
   than left orphaned as a `PENDING` request the mentor could still accept.
3. **Notify receiver.** A `SESSION_REQUEST` notification is created (durable
   in-app row) and pushed best-effort via FCM with data
   `{ type: 'SESSION_REQUEST', sessionId }`.
4. **Receiver identification** is purely `session.mentorId` — the mentor is
   whoever the aspirant booked. There is no directory lookup or dial step.
5. **Accept.** The mentor — **who must already be in the app** — opens the
   sessions list and taps Accept. `session_list_screen.dart`
   `_acceptAndMaybeJoin()` calls `POST /sessions/:id/accept`, then, if the
   session is `AUDIO_CALL`, immediately `context.push('/call/:id')`.
   Backend sets status `ACCEPTED` and sends a `SESSION_ACCEPTED` notification
   to the aspirant with data `{ type, sessionId, sessionType: 'AUDIO_CALL' }`.
6. **Caller navigation.** `core/push/push_service.dart` `_handleDeepLink()`
   navigates to `/call/:sessionId` **only** when
   `type == 'SESSION_ACCEPTED' && sessionType == 'AUDIO_CALL'`. It listens on
   `onMessageOpenedApp`, `onMessage`, and `getInitialMessage()`.
7. **Permission.** `call_screen.dart` first invokes
   `uniscope/permissions#requestMicrophone`. Denial → `_Phase.permissionDenied`.
8. **Signalling / token.** `GET /sessions/:id/call/token` returns
   `{ appId, channelName, token, uid }`. The channel name is lazily
   provisioned as `call-<sessionId>` on first request. The token is minted by
   `AgoraService.generateRtcToken()` via
   `RtcTokenBuilder.buildTokenWithUserAccount`, scoped to that one channel and
   that one user account (the caller's own `userId` as a string account), role
   `PUBLISHER`, expiring after 1 hour.
   **Agora is the entire signalling layer.** There is no WebSocket, no SIP,
   no custom signalling server.
9. **Media connect.** `_joinAgoraChannel()` creates the engine, calls
   `enableAudio()` and `setDefaultAudioRouteToSpeakerphone(true)`, registers
   `onUserJoined` / `onUserOffline` handlers, then
   `joinChannelWithUserAccount(...)` with
   `channelProfileCommunication` + `clientRoleBroadcaster`. The join is wrapped
   in a **20-second timeout** that converts a silent native-layer hang into a
   visible error.
10. **Dual confirm.** Each side then calls `POST /sessions/:id/call/joined`.
    `confirmJoined()` records `aspirantJoinedAt` or `mentorJoinedAt`. Only when
    **both** are set does it transition to `IN_PROGRESS` and settle billing —
    guarded by an `updateMany` on `status IN (ACCEPTED, RINGING)` so the
    transition is idempotent against the two confirms racing.
11. **Billing settlement.** If a hold exists →
    `walletService.consumeHoldAndBill()` (debits aspirant, credits mentor the
    identical amount). If no hold → free-tier path, decrement
    `freeCallSecondsRemaining`, clamped at 0.
12. **Call state maintenance.** The mobile client **polls
    `GET /sessions/:id` every 2 seconds** (`_pollTimer`). There is no
    server push of call state. A 1-second `_tickTimer` drives the elapsed
    display off `session.startedAt`.
13. **Overrun.** `_checkSlotCutoff()` compares elapsed against
    `billedMinutes × 60`. On expiry the aspirant sees a "continue?" dialog;
    accepting calls `POST /sessions/:id/call/extend` (+5 min, direct
    debit/credit with no hold, since both parties are already present).
    If the aspirant does not respond within a 20-second grace period, the
    client ends the call with `SLOT_EXPIRED`.
14. **Termination.** Either party calls `POST /sessions/:id/call/end` →
    status `COMPLETED`, `endedAt`, `endReason`; any still-`ACTIVE` hold is
    defensively released; the other party gets a `SESSION_ENDED` notification.
    Billing is **not** re-run at end — it was settled at connect/extend.
15. **No answer.** If the session has not reached `IN_PROGRESS` within
    **45 seconds**, `_noAnswerTimer` fires and ends the call as `NO_ANSWER`.

**Failure modes**

| Condition | Actual behaviour |
|---|---|
| Receiver not in the app | **No deep-link.** `SESSION_REQUEST` is an ordinary tray notification; tapping it does not open the call. Caller times out at 45s → `NO_ANSWER`. |
| Push delayed / token stale / notifications denied | Same as above for the receiver. For the *caller*, the accept deep-link is missed and they must open the call manually from the sessions list. |
| Agora native join hangs | 20s timeout → `_Phase.error` with a user-visible message. |
| Only one side confirms join | Session never reaches `IN_PROGRESS`; **no billing occurs**; caller's 45s no-answer timer ends it. |
| Network drop mid-call | Poll failures are swallowed (`catch (_)`); the next tick retries. Agora handles media-layer reconnection. No explicit reconnection UI. |
| App backgrounded mid-call | No foreground service (Android) and no `voip`/`audio` background mode (iOS). Sustained background audio is **not** configured. |
| App killed mid-call | No recovery path. Session remains `IN_PROGRESS` server-side until someone calls end; billing already settled. |
| Mic permission denied | `_Phase.permissionDenied`, with an `openAppSettings` affordance. |

**Diagnosability gaps — what is missing to debug a failed call**

1. No server-side truth about media connection. The only "connected" signal
   is the two clients self-reporting. `CLAUDE.md` records that a real Agora
   server-side "user joined channel" webhook was intended but never configured.
2. No structured call logging on either client. `call_screen.dart` contains
   **no logging at all** — no `debugPrint`, no telemetry. A failed call leaves
   no client-side trace.
3. No crash/error-reporting SDK anywhere in the project.
4. `_poll()` swallows every exception silently, so repeated backend failures
   during a call are invisible.
5. No correlation ID shared between mobile, backend, and Agora, so the three
   log surfaces cannot be joined after the fact.
6. `SESSION_REQUEST` push metadata omits `sessionType`, so even if a
   receiver-side deep-link were added, the handler could not currently tell
   an audio-call request from a chat one without an extra fetch.

**Temporary diagnostic code currently present** —
`core/push/push_service.dart` contains `[push]`-prefixed `debugPrint`
statements marked `// TEMP DIAGNOSTIC`, added to diagnose push-token
registration. They log no tokens, headers, or secrets. They should be removed
once push registration is confirmed working; they are safe to leave meanwhile.

### Video calling

**Not implemented.** No video engine calls, no camera capture in the call
path, no video UI. `NSCameraUsageDescription` exists solely for verification
document photo capture via `image_picker`.

### Push notifications

**Provider** — Firebase Cloud Messaging.

**Backend** — `firebase/firebase.provider.ts` initialises `firebase-admin`
from either an inline base64 service-account key
(`FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`, for hosts with no secret-file mount,
e.g. Railway) or a mounted file path. It returns `null` — degrading
gracefully rather than crashing — when `FIREBASE_DISABLED=true` or the key is
absent.

`NotificationsService.send()` always writes the durable `Notification` row
first, then fires a **best-effort** push inside a `.catch()`. Push failure
never blocks the in-app notification. Tokens rejected as
`registration-token-not-registered` / `invalid-registration-token` are pruned
automatically. Payload shape: `{ notification: {title, body}, data: { type,
...metadata } }`.

**Mobile** — `core/push/push_service.dart` requests permission, obtains the
FCM token, uploads it to `POST /users/me/push-token`, re-uploads on
`onTokenRefresh`, and handles the three delivery paths. Registration is
triggered from `main.dart` via `ref.listenManual(authControllerProvider, ...)`
with `fireImmediately: true`, so it covers both fresh login and cold start
with a hydrated session. `_upload()` catches all errors (a failed upload only
means this device misses pushes; it must never block the app).

---

## PAYMENTS

**Wallet** — `Wallet.balanceMinor`, always **integer minor units (paise)**.
Surfaced to aspirants as "Uniminutes" (1 Uniminute = 1000 minor units = ₹10).
Conversion helpers live in `mobile_flutter/lib/core/network/wallet_api.dart`
(`minorToUniminutes`, `slotUniminutes`, `uniminutesLabel`).

**Ledger** — `LedgerEntry` with `LedgerEntryType`
(`TOPUP`, `SESSION_DEBIT`, `SESSION_CREDIT`, `REFUND`, `PAYOUT`). Every write
goes through `applyLedgerEntry` with an **idempotency key** derived from a
stable source, so retries cannot double-apply.

**Holds** — `WalletHold` (`ACTIVE` / `CONSUMED` / `RELEASED`). Placed at
audio-call booking time; consumed at dual-confirm connect; released on
reject/cancel/end.

**Top-up** — Razorpay Orders API. Primary reconciliation is the webhook, whose
HMAC is verified against the raw request body. A direct client-confirm
fallback exists for local development, where a webhook cannot reach localhost.

**Session billing** — see § Audio calling steps 2, 11, 13. Chat is always free
(`ratePerMinuteMinor: 0`).

**Payouts** — `PayoutRequest`, amount always derived from unpaid
`SESSION_CREDIT` history, minimum enforced, admin-only state transitions,
wallet debited only on `COMPLETED`. **No auto-disbursement** — deliberate.

**Failure modes** — a Razorpay webhook that never arrives leaves a top-up
unreconciled (idempotency makes a later retry safe). A crash between
`consumeHoldAndBill` and the `totalCostMinor` update would leave the session
cost field stale while the ledger is correct; the ledger is the source of truth.

---

## INFRASTRUCTURE

**Backend hosting (production)** — Railway, project "Uniscope Mobile",
service `uniscope`, environment `production`, public domain
`uniscope-production.up.railway.app`. Deploys from Git.

**`render.yaml` (repository root)** — a Render service descriptor is committed
and configured for a `uniscope-backend` web service with health check
`/health`. Whether Render is still in use, or is vestigial from an earlier
migration, is UNKNOWN — HUMAN INPUT REQUIRED.
**It pins `OTP_PROVIDER_TYPE: mock` as a literal value under
`NODE_ENV: production`.** See `SECURITY.md` § Finding S-1.

**Public web hosting** — Vercel, team `uniscope2`, project `uniscope`,
production branch `prod/web-enrollment-site`, Root Directory `web`, serving
`uniscope.in` and `www.uniscope.in`.

**Admin panel hosting** — TODO — HUMAN INPUT REQUIRED. The admin panel is
intended to be a separately-deployed, non-public surface, not linked from
user-facing apps; no deployment descriptor for it was found.

**Local development** — `infrastructure/docker/docker-compose.yml`;
backend on port 3001 with prefix `/api/v1`; admin must run
`next dev --webpack` (Turbopack cannot resolve `lightningcss`'s native binding
in this monorepo's hoisted `node_modules`).

**Database hosting** — Supabase. The free-tier project auto-pauses after
inactivity; DB calls then fail until it is resumed from the dashboard.

**CI/CD** — **none.** `.github/` contains only `pull_request_template.md` and
`ISSUE_TEMPLATE/`. There is no `.github/workflows/` directory. Nothing lints,
type-checks, tests, or builds automatically on push or PR. Vercel's own Git
integration builds `web/` on push to the production branch; Railway builds the
backend on push. Neither runs the test suite.

**Monitoring / error reporting** — **none.** No Sentry, Crashlytics, or
Bugsnag in mobile or backend. Backend uses NestJS's built-in `Logger` in 6
files. Available runtime telemetry is limited to Railway deploy/HTTP logs and
Vercel build/function logs.

---

## Branching and environments

| Branch | Role |
|---|---|
| `main` | Default branch. **Not** the source for the deployed web project. |
| `prod/web-enrollment-site` | Production source for the Vercel `web` project. |
| `stage/web-enrollment-site` | Staging branch for `web`; gets Vercel preview deploys. |
| `feature/flutter-migration` | Historical mobile migration branch. |

Promotion flow for `web` is merge `stage/web-enrollment-site` →
`prod/web-enrollment-site`, then push; Vercel deploys on push to the
production branch.

**There is no staging backend and no staging database.** Development,
staging, and production for the API are not three environments — there is
local plus Railway production. This is a material constraint on any
"deploy to staging first" workflow. See `RELEASE.md`.

---

## Configuration and secrets strategy

Configuration is environment-variable driven, validated at boot by a Joi
schema (`backend/src/config/validation.schema.ts`) with typed config objects
in `backend/src/config/`.

| Location | Contents | Committed? |
|---|---|---|
| `backend/.env` | All backend secrets | No (gitignored) |
| `backend/.env.example` | Placeholder template | Yes (safe) |
| `admin/.env.local` | Admin credentials, admin panel user id | No |
| `web/.env.local` | `NEXT_PUBLIC_API_URL` | No |
| `mobile_flutter/android/key.properties` | Release signing | No |
| `backend/firebase-service-account.json` | FCM admin key | No |
| `mobile_flutter/android/app/google-services.json` | Firebase Android | No |
| `mobile_flutter/ios/Runner/GoogleService-Info.plist` | Firebase iOS | **Yes — tracked** |

The iOS plist inconsistency is documented in `SECURITY.md` § Finding S-2.

Mobile build-time configuration is passed via `--dart-define` (currently only
`API_URL`); there is no `.env` mechanism in the Flutter app.

---

## Tests (actual)

| Location | Files | Reality (verified by execution 2026-08-13) |
|---|---|---|
| `backend/src/app.controller.spec.ts` | 1 | Default Nest scaffold. **`npx jest` hangs indefinitely** — did not terminate in 180s even with `--forceExit` |
| `backend/test/app.e2e-spec.ts` | 1 | Default Nest e2e scaffold; outside jest's `rootDir: src`, so `npm test` never runs it |
| `mobile_flutter/test/` | 3 | **All 3 fail to compile** — `flutter test` = 0 passed, 3 failed |

The Flutter tests reference symbols that no longer exist:
`UserRole.prospectiveStudent` (removed in the role-collapse migration), a
stale `UsersApi.updateProfile` signature, and a non-existent `MyApp` class
(the app class is `UniscopeApp`). They have been broken since those changes
landed.

The backend jest hang is likely a ts-jest/ESM configuration mismatch:
`tsconfig` sets `module: nodenext` and the source uses ESM `.js` import
specifiers, but `package.json` declares no `"type": "module"` and jest has no
ESM setup.

**So the accurate statement is not "thin coverage" — it is that there is
currently no working automated test suite on either side.** There are also no
tests at all for sessions, wallet, billing, auth, calling, chat, payouts,
verification, or notifications. The project convention documented in
`CLAUDE.md` has been manual verification against the real running backend and
real Supabase database (curl + throwaway records), not automated tests.

---

## Documentation drift (code vs. docs)

Recorded so agents trust the right source:

1. **`CLAUDE.md` claims there is no iOS permissions channel** ("no Swift
   equivalent exists yet"). **False** — `ios/Runner/AppDelegate.swift`
   implements the same `uniscope/permissions` contract. Code wins.
2. **`CLAUDE.md` § "What's NOT built yet" lists push notifications as
   unbuilt** with a placeholder `FIREBASE_PROJECT_ID`. **Stale** — the full
   loop (token registration → storage → `firebase-admin` send → client
   handling) is implemented, and a real Firebase project (`uniscope-83eeb`)
   is configured.
3. **`AGENTS.md` and `CLAUDE.md` are near-identical duplicates**, differing
   only in tool naming. Any factual update must be applied to both or they
   will diverge silently.
4. **`CLAUDE.md` states the branch is `feature/flutter-migration`.** The
   active branches are now the `stage/` and `prod/web-enrollment-site` pair.
