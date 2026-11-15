# DEFINITION OF DONE — UniScope

A task is **not** done when the code compiles. It is not done when the PR is
open. It is not done when CI is green — this repository has no CI, so green is
not even available as a signal.

---

## The checklist

A task is complete only when **all** of the following are true.

### Understanding
- [ ] **Requirement understood.** Restated in your own words, ambiguities
      resolved with a human rather than assumed.
- [ ] **Correct project identified.** Changes land in UniScope, in the right
      workspace (`backend/`, `mobile_flutter/`, `admin/`, `web/`).
- [ ] **Existing architecture inspected.** The actual code was read before
      being changed, not just the documentation — which is known stale in
      places (`ARCHITECTURE.md` § Documentation drift).
- [ ] **Risk tier assigned** per `RISK_RULES.md`, and approval obtained if
      HIGH or CRITICAL — *before* the work, not after.
- [ ] **No locked-in business rule silently changed** (`PROJECT.md` §
      Important business rules). If the task requires changing one, it was
      raised explicitly.

### Implementation
- [ ] **Implementation complete** — no stubs, no `TODO` standing in for
      required behaviour, no commented-out code left behind.
- [ ] **Minimal and architecture-preserving** (`ENGINEERING_RULES.md` § A).
- [ ] **No unnecessary dependencies** added.
- [ ] **No secrets** hardcoded, committed, or logged.
- [ ] **Conventions followed**: integer minor units for money, idempotency
      keys on ledger writes, explicit response projections, 404-not-403 for
      non-party access.
- [ ] **Temporary diagnostic code removed**, or explicitly flagged with a
      reason for keeping it.

### Testing
- [ ] **Test strategy defined** — automated where possible; an explicit manual
      protocol where not. "No test" is acceptable only when stated openly and
      justified.
- [ ] **Relevant tests added or updated.**
- [ ] **Tests actually executed**, with real output.
- [ ] **Results recorded** — for device-dependent work, a completed record in
      `ai/test-results/` following `TEMPLATE.md`.
- [ ] **Results reported honestly.** Nothing marked PASS without evidence.
      BLOCKED and "not run" are valid, useful outcomes.
- [ ] **Required manual device testing completed** for any change touching
      calling, push, permissions, payments, or native platform code — meaning
      `CALL_TEST.md` executed on real hardware, not assumed.

### Review
- [ ] **Security reviewed** against `SECURITY.md` — data classification
      respected, no forbidden autonomous action taken, nothing sensitive added
      to a response, log, or test record.
- [ ] **Regression risk reviewed.** What else touches this code path? Given
      near-zero automated coverage, this reasoning is the *primary* defence
      against regressions — it is not optional.
- [ ] **Migration reviewed** if the schema changed, including rollback
      implications (`RELEASE.md` § Backend release).
- [ ] **Documentation updated** where behaviour changed. If it contradicts
      `CLAUDE.md`/`AGENTS.md`, **both** were updated — they are near-duplicates
      and drift silently.

### Delivery
- [ ] **PR created** with: what changed, why, risk tier, tests run and their
      real results, and what was *not* tested.
- [ ] **CI passes** — where CI exists. It does not currently exist in this
      repository; note this rather than implying a green pipeline.
- [ ] **Human approval obtained** for HIGH/CRITICAL changes and for any
      production deployment.

---

## Explicitly NOT sufficient

None of these alone means done:

| Signal | Why it is insufficient |
|---|---|
| "It compiles" / `tsc` clean | Says nothing about whether billing settles or a call connects |
| `flutter build apk` succeeds | The Agora crash was a *runtime* `UnsatisfiedLinkError`; the build succeeded |
| `flutter analyze` clean | Static analysis only |
| CI passes | **There is no CI here.** And it would not cover devices, payments, or calls |
| Vercel/Railway deployed | Deployment is not verification |
| "It worked on the emulator" | Calling, push, and payments need real devices |
| "The API returned 200" | Verify the resulting *state* — ledger, hold, session row |
| "I reviewed the code carefully" | Not a substitute for execution |

---

## Definition of done for the audio call specifically

Because it is the current focus and the least verifiable area, calling work is
done only when:

- [ ] `CALL_TEST.md` CALL-001 executed on **two real physical devices**
- [ ] Executed on **both** Android and iOS, or the untested platform stated
      plainly
- [ ] Relevant negative tests executed (at minimum CALL-003, CALL-004,
      CALL-008)
- [ ] Billing verified in the database — one debit, one credit, equal amounts,
      hold consumed exactly once
- [ ] Evidence records committed under `ai/test-results/`
- [ ] Any failure captured with the full evidence set in `CALL_TEST.md` §
      Failure information

**Until that happens, the correct statement is "audio calling is unverified"
— not "audio calling works."**
