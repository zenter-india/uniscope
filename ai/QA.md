# QA — UniScope

QA strategy for this project, and an honest statement of where coverage
actually stands today.

Enumerated cases with IDs live in [TEST_MATRIX.md](TEST_MATRIX.md).
The two-device call protocol is in [CALL_TEST.md](CALL_TEST.md).
Evidence goes in [test-results/](test-results/).

---

## Current reality (do not overstate this)

| Layer | What exists | Assessment |
|---|---|---|
| Automated unit (backend) | `backend/src/app.controller.spec.ts` (default Nest scaffold, asserts a string) | **Cannot run — jest hangs** (see below) |
| Automated integration | `backend/test/app.e2e-spec.ts` (default Nest scaffold) | Outside jest's `rootDir: src`; not run by `npm test` |
| Mobile widget/unit | `mobile_flutter/test/{widget_test,boot_test,flow_test}.dart` | **All 3 fail — do not compile** (see below) |
| CI | **None.** No `.github/workflows/` directory exists | Nothing runs automatically |
| Manual device QA | Performed ad hoc; no recorded evidence in-repo | Undocumented |
| Crash/error reporting | **None** (no Sentry/Crashlytics/Bugsnag) | No production signal |

### Both test suites are currently broken

Verified by execution on 2026-08-13:

**Flutter — 3/3 test files fail; none compile.** `flutter analyze` reports 5
errors, all in `test/` (production `lib/` is clean, 0 errors):

- `test/flow_test.dart` references `UserRole.prospectiveStudent`, which was
  **removed** when roles were collapsed to `ASPIRANT`/`MENTOR`. The tests were
  never updated after that migration.
- `test/flow_test.dart`'s `_FakeUsersApi.updateProfile` no longer matches the
  real `UsersApi.updateProfile` signature (which has since grown ~19 params).
- `test/widget_test.dart` instantiates `MyApp`, which does not exist — the app
  class is `UniscopeApp`.

`flutter test` result: **0 passed, 3 failed.**

**Backend — `npx jest` does not terminate.** It hung past 180s twice, even
when narrowed to the single trivial `app.controller.spec.ts` with
`--forceExit`. Likely cause: `tsconfig` uses `module: nodenext` and the source
uses ESM `.js` import specifiers, but `package.json` has no `"type": "module"`
and jest has no ESM configuration — a known-broken ts-jest combination. Not
investigated further, because fixing it is a code change outside the scope of
this documentation task.

**Implication:** the honest baseline is that this project has **no working
automated test suite at all** — not merely thin coverage. Fixing the two
harnesses is a prerequisite for any meaningful automated QA, and is the
cheapest high-value work available (see § Priority gaps).

**Nothing in the following areas has automated coverage:** authentication,
sessions, wallet, billing, holds, payouts, calling, chat, notifications,
verification, reports, blocks, or admin actions.

The project's actual historical convention (recorded in `CLAUDE.md`) has been
**manual verification against the real running backend and real Supabase
database** — create throwaway records with a Prisma script, `curl` the
endpoints, verify DB state, clean up. That is a legitimate method and it is
how most modules were validated. It is not a substitute for regression
coverage, because it is not repeatable automatically.

**Consequence for agents:** there is no safety net. A change that compiles and
deploys can still break billing or auth silently. Weight manual verification
and human review accordingly — see `RISK_RULES.md` § UniScope-specific risk
notes.

---

## 1. Automated QA

Runnable today:

```bash
# Backend — unit
npm run test --workspace=backend

# Backend — type check (more useful than the test suite right now)
cd backend && npx tsc -p tsconfig.build.json --noEmit

# Backend — lint
npm run lint --workspace=backend

# Mobile — analyze (static analysis; the highest-value mobile gate)
cd mobile_flutter && flutter analyze

# Mobile — tests
cd mobile_flutter && flutter test

# Web / admin — production build (catches type + build errors)
cd web && npx next build
cd admin && npx next build
```

**Priority gaps, highest value first.** These are recommendations, not
completed work:

0. **Repair the two test harnesses first** — until `flutter test` and
   `npx jest` actually run, nothing below can be written or verified.
   Flutter: update the 3 stale test files to the current `UserRole` enum,
   `UsersApi` signature, and `UniscopeApp` class name. Backend: resolve the
   ts-jest/ESM configuration so a trivial spec terminates.
1. `SessionsService` state machine — accept/reject/cancel guards, and above
   all `confirmJoined` (dual-confirm idempotency, the `updateMany` race
   guard, hold-consume vs free-tier branch).
2. `WalletService` — `applyLedgerEntry` idempotency, hold lifecycle,
   `getAvailableBalanceMinor`, the mentor-credit-equals-aspirant-debit
   invariant.
3. Authorization — non-party access returns **404**; banned user is rejected
   at `JwtStrategy.validate()`.
4. Response projections — assert no `phoneHash` / `realNameEncrypted` /
   `documentKey` leaks in any `toXResponse()`.
5. Razorpay webhook HMAC verification against a known raw body.

These are pure-logic, high-risk, and cheap to test — they do not need devices.

---

## 2. Integration QA

**Not currently implemented.** What would be exercised:

- Auth: request OTP → verify → token pair → authenticated call → refresh →
  banned-user rejection.
- Session (chat): create → channel provisioned → status `ACCEPTED` immediately.
- Session (call): create → hold placed → accept → token issued → dual
  confirm → `IN_PROGRESS` → billing settled → end → hold released.
- Wallet: top-up order → webhook → ledger → balance; insufficient-balance
  booking is rejected **and** leaves no orphaned session row.
- Payout: derive amount → request → admin transitions → wallet debited only on
  `COMPLETED`.

**Constraint to respect:** there is **no staging backend or staging database**
(`ARCHITECTURE.md` § Branching and environments). Integration tests must run
against a local backend and a disposable database, never against production.

---

## 3. Manual physical-device QA

Required for anything that cannot be exercised in CI or a simulator:

| Area | Why it needs a real device |
|---|---|
| Audio calling | Two devices, real microphones, real network — see `CALL_TEST.md` |
| Push notifications | FCM does not deliver to a simulator meaningfully; iOS needs a real APNs token |
| Microphone permission | Real OS permission dialogs and denial states |
| Razorpay checkout | Native SDK; real payment sheet |
| Background/foreground | Real OS lifecycle and process death |
| Audio routing | Speaker / earpiece / Bluetooth switching |

**Both platforms must be covered separately.** Android and iOS diverge
materially here: different permission channels
(`MainActivity.kt` vs `AppDelegate.swift`), different push semantics, and a
vendored Agora AAR that exists only on Android.

Every manual run must produce a record in `ai/test-results/` using
`TEMPLATE.md`. A test with no record did not happen.

---

## 4. Release QA

Before any production release, and always gated on human approval:

1. All automated checks above pass, with output recorded.
2. `CALL_TEST.md` executed on **both** platforms, with evidence records.
3. Auth smoke test on a real device (fresh install → OTP → onboarding → home).
4. Push smoke test on a real device (token registers; a session notification
   arrives).
5. Payment smoke test (top-up in Razorpay test mode; ledger and balance
   correct).
6. Confirm `OTP_PROVIDER_TYPE` is **`twilio`**, not `mock`, in the target
   environment (`SECURITY.md` § S-1).
7. Confirm no secret was added to the repository.
8. Verify migrations applied cleanly, and that any new migration is reversible
   or its irreversibility is explicitly accepted.
9. Human approval recorded — see `RELEASE.md`.

---

## Coverage by feature area

Legend: **A** automated · **M** manual required · **N** none today

| Area | Status | Notes |
|---|---|---|
| Onboarding (aspirant) | N | Wizard verified live once, historically |
| Onboarding (mentor) | N | Backend round-trip verified via curl; UI click-through never completed |
| Authentication | N | Highest-value untested area |
| Profiles / avatars | N | Task #102 "verify end-to-end live" still open |
| Universities | N | Data import verified live |
| Mentors / discovery | N | |
| Chat | N | Verified live once against real Stream |
| **Audio calls** | **M — never verified** | See `CALL_TEST.md`; blocking gap |
| Video calls | — | Not implemented |
| Wallet / top-up | M | Requires real Razorpay flow |
| Billing / holds / ledger | N | Pure logic — should be automated first |
| Payouts | N | Verified via curl historically |
| Notifications / push | M | Registration path recently instrumented |
| Permissions | M | Real OS dialogs only |
| Navigation | Partial A | `flow_test.dart` covers some routing |
| Error handling | N | |
| Offline / network loss | N | |
| Android specifics | M | Vendored Agora AAR, `MainActivity` channel |
| iOS specifics | M | APNs entitlements, `AppDelegate` channel |

---

## Known open verification items

Carried forward from the project task list and `CLAUDE.md`:

1. **Two-device audio call never verified on real hardware.** The Android
   Agora crash was root-caused and fixed at the build level (vendored patched
   AAR; `unzip -l` confirmed both `libAgoraRtcWrapper.so` and
   `libagora-rtc-sdk.so` are packaged for all four ABIs), but **no live call
   has been confirmed**. iOS has never been exercised for calling at all.
2. **Avatar customiser end-to-end** — open task.
3. **Mentor onboarding wizard UI click-through** — backend payload verified;
   UI never completed end-to-end due to browser-pane flakiness.
4. **Push delivery to a real device** — token registration was instrumented
   with temporary `[push]` diagnostics; end-to-end delivery unconfirmed.

None of these may be reported as passing without a `test-results/` record.

---

## Rules for reporting QA results

1. **Never mark a test PASS without evidence.** For device tests, evidence is
   a completed `test-results/` record.
2. **BLOCKED is a valid, useful result.** "Could not run — no second device"
   is more useful than silence and far more useful than an assumption.
3. **State what was actually executed**, not what would normally be executed.
4. **A build succeeding is not a test passing.** `flutter build apk` says
   nothing about whether a call connects.
5. **Report partial results honestly** — e.g. "Android PASS, iOS not run".
