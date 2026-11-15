# RISK RULES — UniScope

Risk classification for changes to this repository, used by a generic
Planner/Risk agent to decide whether human approval is required before a
change proceeds.

**Rule of precedence:** a change takes the **highest** tier any part of it
touches. A one-line UI tweak inside the call screen is HIGH, not LOW, because
the call screen is HIGH.

**When uncertain, escalate one tier.** Misclassifying downward is the
expensive direction.

---

## LOW

Merge without human approval, provided `DEFINITION_OF_DONE.md` is satisfied.

- Documentation (`docs/`, `ai/`, `README.md`, `CONTRIBUTING.md`, code comments)
- Isolated copy/text changes that do not touch a locked-in business rule
  (see `PROJECT.md` § Important business rules)
- Isolated low-risk UI changes: spacing, colour tokens, typography, icon
  swaps — **outside** the call, wallet, and auth screens
- Non-sensitive cleanup: dead code removal, import ordering, formatting
- Adding or improving tests that do not modify product code
- `web/` marketing-site content changes

---

## MEDIUM

Merge with review; human approval not strictly required, but the change must
carry evidence.

- Normal feature work in non-sensitive modules (mentors, universities,
  reviews, wishlist, blocks, avatar, enrollments)
- Normal API additions that do not alter auth, wallet, or session semantics
- Moderate UI changes, including new screens outside the sensitive set
- Non-critical refactoring within a single module
- Adding a new non-sensitive Prisma **field** (nullable, additive, no backfill)
- Admin-panel changes that do not alter what admins are permitted to do
- Dependency **patch** upgrades

---

## HIGH — requires human approval

Do not merge on an agent's own judgement.

- **Authentication**: OTP providers, JWT issuance/TTL/refresh, phone hashing,
  the per-request ban lookup in `JwtStrategy.validate()`
- **Authorization**: guards, `@Roles`, session-party checks, the 404-over-403
  convention, response projections (`toXResponse()`)
- **Wallet**: balances, minor-unit representation, holds, Uniminute conversion,
  the recharge margin
- **Billing**: session cost calculation, ledger writes, idempotency keys,
  free-tier consumption, the extend/overrun path
- **Payouts**: derivation from `SESSION_CREDIT` history, minimums, state
  transitions
- **Notifications**: FCM payload shape, token registration/pruning, the
  deep-link contract in `push_service.dart`
- **Audio calling**: anything in `features/calls/call_screen.dart`,
  `modules/sessions/`, `modules/agora/` — including the dual-confirm contract,
  token scope/TTL, channel naming, poll interval, no-answer and cutoff timers
- **Database schema**: any migration; especially enum remaps, column drops,
  type narrowing, and anything requiring a backfill
- **Native Android/iOS**: Gradle config, `compileSdk`, the vendored Agora AAR
  and its exclusion, manifest entries, `AppDelegate`/`MainActivity`,
  Podfile/SPM changes
- **Permissions**: adding, removing, or changing any runtime permission or its
  usage-description string
- **Production configuration**: environment variables, `render.yaml`,
  Railway/Vercel project settings, domain routing
- **Rate limiting and throttling** thresholds
- Dependency **major** upgrades, or any change touching the Agora, Firebase,
  Stream, or Razorpay SDKs

---

## CRITICAL — requires explicit, specific human authorization

An agent must **never** perform these autonomously, and must not treat a
general "go ahead" on a task as covering them. Authorization must name the
specific action.

- **Deleting or truncating production database data**; any destructive or
  irreversible migration (column/table drop with live data, enum remap without
  a preserving `USING` clause)
- **Changing any production credential**: JWT secrets, `PROFILE_ENCRYPTION_KEY`,
  Supabase service-role key, Razorpay keys, Agora certificate, Stream secret,
  Twilio token, Firebase service account
- **Authentication bypass** of any kind, including "temporarily" for testing
- **Authorization bypass**, including widening an admin route or removing a
  party check
- **Disabling security controls**: guards, validation pipes, HMAC verification,
  rate limits, the ban lookup
- **Setting `OTP_PROVIDER_TYPE=mock`** on anything reachable outside
  localhost — this makes a fixed code valid for every phone number
  (`SECURITY.md` § Finding S-1)
- **Payment security changes**: Razorpay webhook signature verification,
  idempotency key derivation, hold-consumption logic
- **Production infrastructure changes**: Railway/Vercel project settings,
  custom domain reassignment, deleting a deployment or project
- **Signing/release credential changes**: Android keystore or
  `key.properties`, iOS certificates/provisioning profiles, entitlements
- **Publishing to Play Store or App Store**, including internal/TestFlight
  tracks
- **Rotating or exposing** any secret listed in `SECURITY.md` § SECRET
- **Force-pushing or rewriting history** on `main`, `prod/*`, or `stage/*`

---

## Approval mechanics

| Tier | Approval | Evidence required |
|---|---|---|
| LOW | None | Change description |
| MEDIUM | Reviewer (human or generic Reviewer agent) | Tests run, or explicit statement that none exist |
| HIGH | Named human approval before merge | Test evidence; for calling/push, a `test-results/` record |
| CRITICAL | Named human authorization for the **specific** action | Explicit written go-ahead quoting the action |

**Escalation triggers** — reclassify upward immediately if a change:

- touches a file in both a sensitive and non-sensitive area,
- was described as low-risk but requires a migration,
- requires disabling any check to pass,
- cannot be tested by any available means,
- contradicts a locked-in business rule in `PROJECT.md`.

---

## UniScope-specific risk notes

**Every change is riskier here than in a typical repository, because there is
no CI and near-zero automated test coverage** (`ARCHITECTURE.md` §
Infrastructure, § Tests). Nothing will catch a regression automatically. Treat
"the build succeeded" as weak evidence.

**There is no staging backend.** The API has local and production, not three
tiers. A backend change cannot be validated in a production-like environment
before it reaches production. This raises the effective risk of every backend
change and is the strongest argument for human approval on anything touching
sessions, wallet, or auth.

**The audio call path cannot currently be verified in this environment at
all** — it needs two real devices (`CALL_TEST.md`). Any change touching it is
HIGH by default and unverifiable without human execution of the manual test.
