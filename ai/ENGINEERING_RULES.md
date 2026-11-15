# ENGINEERING RULES — UniScope

Rules any agent or engineer must obey when changing this repository.
These are **project-specific**; they encode where UniScope is genuinely
fragile, not generic best-practice boilerplate.

Risk tiers referenced here are defined in [RISK_RULES.md](RISK_RULES.md).
Completion criteria are in [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md).

---

## A. Before changing anything

**A1. Inspect the existing code before modifying it.**
Read the actual implementation, not just documentation. Repository
documentation is known to be stale in specific places (see
`ARCHITECTURE.md` § Documentation drift). **When docs and code disagree, the
code is authoritative** — and the drift should be corrected in the docs as
part of the change.

**A2. Prefer minimal, safe changes.**
Scope the edit to what the request actually requires. A working system with a
documented rationale is not an invitation to refactor.

**A3. Preserve the existing architecture.**
Do not introduce a new state-management approach, HTTP client, navigation
library, ORM, or provider. UniScope has exactly one of each; alternatives
create split-brain implementations.

**A4. Do not rewrite working systems without explicit approval.**
This applies with particular force to the audio-call state machine, the
wallet ledger, and the session lifecycle.

**A5. Do not introduce unnecessary dependencies.**
Every added package is a supply-chain, build-time, and native-toolchain risk.
The Android build in particular is sensitive (see A6). Justify additions.

**A6. Treat the Android Agora build configuration as load-bearing.**
`mobile_flutter/android/app/libs/iris-rtc-patched.aar` and the corresponding
`exclude(group: "io.agora.rtc", module: "iris-rtc")` are **the fix** for an
AGP manifest-package conflict, not leftover cruft. Removing either one either
breaks the build or silently ships an app whose "Join Call" crashes with
`UnsatisfiedLinkError`. Likewise `compileSdk = 36` and the
`rootProject.extra["compileSdkVersion"]` assignment exist because Agora's
transitive dependencies require them. Do not "clean up" any of this.

---

## B. Architecture areas requiring explicit human approval

Changes in these areas are **HIGH or CRITICAL** risk and must not be merged on
an agent's own judgement.

**B1. Do not change authentication architecture without approval.**
Includes: the OTP provider interface, JWT issuance/TTL, the per-request ban
lookup in `JwtStrategy.validate()`, phone hashing, or the refresh flow.

**B2. Do not change payment or wallet architecture without approval.**
Includes: minor-unit representation, the hold lifecycle, ledger idempotency
keys, the Uniminute conversion, the recharge margin, or payout derivation.

**B3. Do not change calling architecture without approval.**
Includes: the dual-confirm connect contract, Agora token scope/TTL, channel
naming, the fixed-slot billing model, the overrun cutoff, or the polling
interval.

**B4. Do not change native Android or iOS signing configuration without
approval.** Includes `key.properties` handling, signing configs, entitlements,
and bundle/application identifiers.

**B5. Database migrations require explicit review.**
Prisma 7 in this repository has specific constraints: `migrate dev` and
`migrate reset` need a TTY and will not work in a non-interactive session; use
`migrate diff --from-config-datasource --to-schema` plus a hand-created
migration folder (14-digit timestamp prefix) and `migrate deploy`. Enum value
**remaps** cannot be expressed by the diff tool and must be hand-written with
the create-new-type / `ALTER TABLE ... USING (CASE ...)` / drop-old / rename
pattern — see the existing
`*_collapse_user_role_to_aspirant_mentor/migration.sql` for a worked example
that preserved live user data instead of resetting it.

---

## C. Security rules

**C1. Do not bypass authorization.**
Every session-scoped route must verify the caller is a party to the session.
Return **404, not 403**, for resources the caller is not party to — this is a
deliberate convention that avoids leaking resource existence.

**C2. Do not bypass database security or response projections.**
Never return a raw Prisma row. Every entity has an explicit allowlist
projection (`toXResponse()`); this is what prevents `phoneHash` and
`realNameEncrypted` from leaking as the schema grows. New fields must be
consciously added to a projection to become visible.

**C3. Do not disable security controls to make tests or builds pass.**
Rate limits, guards, validation pipes, HMAC verification, and the ban lookup
are not obstacles to route around. If a control blocks a legitimate test,
change the test setup, not the control.

**C4. Never hardcode secrets. Never commit credentials.**
All secrets come from environment variables validated by the Joi schema at
boot. `.env.example` files must contain placeholders only.

**C5. Never weaken the OTP configuration.**
`OTP_PROVIDER_TYPE=mock` makes a fixed code (`111111`) valid for **any** phone
number. It is a local-development affordance only. Never set it to `mock` for
any deployment reachable outside localhost, and never widen where it applies.
See `SECURITY.md` § Finding S-1.

**C6. Never modify production directly.**
No direct writes to the production database, no console-edited production
environment variables, no hand-deployed artifacts, as a side effect of a task.

---

## D. Testing and honesty rules

**D1. Never fabricate test results.**
**D2. Never claim a test passed without evidence.**
For anything requiring real devices, "evidence" means a completed record in
`ai/test-results/` following `TEMPLATE.md`. An agent that did not run the test
must say so plainly. `QA.md` and `TEST_MATRIX.md` deliberately record current
status as *not verified* rather than assumed-passing; keep it that way.

**D3. Every implementation requires a test strategy.**
Automated where the repository supports it; an explicit manual protocol where
it does not (calling, push, payments). "No test" is an acceptable answer only
when stated openly and justified.

**D4. Distinguish "builds" from "works".**
`flutter build apk` succeeding says nothing about whether a call connects.
`tsc` passing says nothing about whether billing settles correctly. Report
what was actually exercised.

**D5. Verify against reality where feasible.**
The project convention has been to test against the real running backend and
real database (create throwaway records via a script, curl the endpoints,
verify state, then clean up), because most modules have no automated coverage.
Follow it, and clean up test data afterwards.

---

## E. Process rules

**E1. High-risk changes require human approval** — see `RISK_RULES.md`.
**E2. Production deployment always requires explicit human approval.**
No agent promotes to production autonomously, regardless of CI state.
**E3. CI passing does not mean production-ready** — and note that this
repository currently has **no CI at all** (`ARCHITECTURE.md` § Infrastructure).
Absence of failure is not evidence of correctness here.
**E4. Update documentation in the same change** when behaviour changes.
If the change contradicts `CLAUDE.md`/`AGENTS.md`, update **both** — they are
near-duplicates and will otherwise diverge silently.
**E5. Respect locked-in product decisions.** The rules in `PROJECT.md` §
Important business rules were deliberate, several reversed an earlier
position, and re-reversing them silently is a real and previously-observed
failure mode. Raise, do not assume.

---

## F. Conventions to follow

- **Money is always integer minor units.** Never floats, anywhere.
- **Idempotency keys on every ledger write**, derived from a stable source
  (hold id, report id, Razorpay payment id).
- **Explicit response projections** for every entity.
- **404 over 403** for non-party resource access.
- **Match surrounding code style.** This codebase uses substantive comments
  that explain *why* a non-obvious decision was made. Preserve them; they are
  the main defence against a future agent "fixing" a deliberate workaround.
- **Keep `lib/core/network/*_api.dart` and backend DTOs in sync.** The mobile
  client sends untyped maps in places; a backend DTO change can break the app
  silently at runtime rather than at compile time.
- **Keep `web/lib/options.ts` in sync with
  `mobile_flutter/lib/features/onboarding/profile_options.dart`.** Enrollment
  leads are meant to convert into real profiles by copying columns across; a
  value mismatch lands a converted account with data the app cannot render.
