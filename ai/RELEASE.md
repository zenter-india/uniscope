# RELEASE — UniScope

The **actual** current release process, and an explicit record of what is not
established. Nothing here is invented; gaps are marked
`TODO — HUMAN INPUT REQUIRED` rather than filled with a plausible-sounding
process.

**Production release always requires explicit human approval.** No agent
promotes to production autonomously, regardless of build or CI state.

---

## Environments (actual)

| Environment | Backend | Database | Mobile |
|---|---|---|---|
| Local | `localhost:3001`, prefix `/api/v1` | Supabase (shared with production — see warning) | `--dart-define=API_URL=http://10.0.2.2:3001/api/v1` (Android emulator) or LAN IP (device) |
| Staging | **Does not exist** | — | — |
| Production | Railway — `uniscope-production.up.railway.app` | Supabase | Release build with production `API_URL` |

> **Two constraints that shape everything below.**
>
> 1. **There is no staging backend and no staging database.** A backend change
>    cannot be validated in a production-like environment before it reaches
>    production. Any "deploy to staging first" step in a generic workflow has
>    no target here.
> 2. **Local development points at the same Supabase project as production**
>    (per `backend/.env`). Local testing can therefore mutate production data.
>    Use throwaway records and clean them up — this is the existing project
>    convention, and it is load-bearing.
>
> Both are recorded as risks, not endorsed as good practice.
> **TODO — HUMAN INPUT REQUIRED**: decide whether a staging backend and a
> separate database are wanted before wider AI-assisted development begins.

---

## CI/CD (actual)

**There is no CI pipeline.** `.github/` contains only
`pull_request_template.md` and `ISSUE_TEMPLATE/`. There is no
`.github/workflows/` directory. Nothing lints, type-checks, tests, or builds
automatically on push or pull request.

What *does* happen automatically:

| Trigger | System | Action |
|---|---|---|
| Push to `prod/web-enrollment-site` | Vercel | Builds and deploys `web/` to `uniscope.in` |
| Push to `stage/web-enrollment-site` | Vercel | Preview deployment |
| Push to the backend's tracked branch | Railway | Builds and deploys the backend |

Neither runs the test suite. Both are build-and-deploy only.

**Vercel project configuration that matters** (learned the hard way, recorded
so it is not rediscovered): Root Directory must be `web` — this is a monorepo,
and building from the repository root pulls in the `backend` workspace, whose
type errors then fail the web build. Production Branch is
`prod/web-enrollment-site`, not `main`.

**Also required for Vercel's Git integration:** commits must carry an author
email that resolves to a GitHub account, or the deployment is blocked before
building.

---

## Android release

**Build** — Flutter, from `mobile_flutter/`:

```bash
flutter build appbundle --release \
  --dart-define=API_URL=https://uniscope-production.up.railway.app/api/v1
```

Note: `API_URL` is compile-time. Omitting it produces a build that targets
`localhost` and cannot work on a device.

**Signing** — `android/key.properties` (gitignored) supplies `storeFile`,
`storePassword`, `keyAlias`, `keyPassword`. `build.gradle.kts` creates the
`release` signing config only if that file exists, and **falls back to debug
signing when it does not** — so a build can silently produce an unshippable
artifact. Verify signing before uploading.

**Build-level constraints** (see `ARCHITECTURE.md` § ANDROID): `compileSdk 36`,
the vendored `iris-rtc-patched.aar`, and the `iris-rtc` exclusion are all
load-bearing. A release build must still contain both
`libAgoraRtcWrapper.so` and `libagora-rtc-sdk.so` for all four ABIs — verify
with `unzip -l` (BUILD-001).

**Internal testing / Play Store process** — TODO — HUMAN INPUT REQUIRED.
The repository contains a `playstore docs/` directory of screenshots, which
suggests a listing exists, but no track configuration, upload process, staged
rollout policy, or release-notes convention is recorded anywhere in-repo.

**Release verification** — TODO — HUMAN INPUT REQUIRED (no documented
post-release smoke process). `QA.md` § Release QA is the recommended minimum
until one is defined.

---

## iOS release

**Build** — Flutter, from `mobile_flutter/`:

```bash
flutter build ipa --release \
  --dart-define=API_URL=https://uniscope-production.up.railway.app/api/v1
```

**Signing** — Xcode-managed. Entitlements are wired via `CODE_SIGN_ENTITLEMENTS`
across build configurations: `Runner.entitlements`
(`aps-environment: development`) and `Runner-Release.entitlements`
(`aps-environment: production`). A release build must use the **production**
APNs environment or push will silently fail on TestFlight/App Store builds.

Specific team ID, provisioning profiles, and certificate management —
TODO — HUMAN INPUT REQUIRED.

**Known constraint:** three plugins do not support Swift Package Manager and
fall back to CocoaPods (`get_thumbnail_video`, `media_kit_video`,
`razorpay_flutter`). Flutter warns that this will become an error in a future
release.

**TestFlight** — historically used (a build has been distributed via
TestFlight previously, per project history), and the Transporter upload path
was discussed. The concrete, repeatable process — TODO — HUMAN INPUT REQUIRED.

**App Store process** — TODO — HUMAN INPUT REQUIRED.

**Release verification** — TODO — HUMAN INPUT REQUIRED.

---

## Backend release

**Process** — push to the tracked branch; Railway builds and deploys.
Migrations run via `prisma migrate deploy` at container start.

**Before any backend deploy:**

1. `npx tsc -p tsconfig.build.json --noEmit` passes.
2. `npm run lint --workspace=backend` passes.
3. Any new migration reviewed explicitly (`ENGINEERING_RULES.md` § B5), with
   destructive steps called out.
4. **`OTP_PROVIDER_TYPE` confirmed as `twilio`, not `mock`**
   (`SECURITY.md` § S-1, TEST_MATRIX RELEASE-002).
5. No secret added to the repository.

**Rollback** — TODO — HUMAN INPUT REQUIRED. Railway supports redeploying a
previous deployment, but note that a **migration is not rolled back** by
redeploying older code. Any migration that is not backwards-compatible with
the previous release effectively removes the rollback option. Treat this as a
strong argument for additive-only migrations.

---

## Web release (`web/`)

Established and working:

```bash
git checkout prod/web-enrollment-site
git pull origin prod/web-enrollment-site
git merge origin/stage/web-enrollment-site --no-edit
git push origin prod/web-enrollment-site
```

Vercel builds on push and deploys to `uniscope.in` / `www.uniscope.in`.

Note: an empty commit will **not** trigger a rebuild — Vercel's monorepo
optimisation skips builds when nothing under the Root Directory changed.

---

## Admin panel release

TODO — HUMAN INPUT REQUIRED. The admin panel is intended to be a
separately-deployed, non-public surface not linked from user-facing apps, but
no deployment descriptor or hosting record for it exists in the repository.

---

## Release gate — required before production

Regardless of surface, and enforced by a human:

1. All automated checks that exist have been run, with output recorded.
2. Required manual device testing complete, with `ai/test-results/` records —
   for any change touching calling, push, permissions, or payments this
   includes `CALL_TEST.md` on both platforms.
3. Risk tier assessed (`RISK_RULES.md`); HIGH/CRITICAL changes carry named
   human approval.
4. Security review for anything in `SECURITY.md`'s sensitive areas.
5. Migrations reviewed; rollback implications stated.
6. Documentation updated (including `CLAUDE.md` **and** `AGENTS.md`, which are
   near-duplicates and drift silently).
7. **Explicit human approval recorded.**

**CI passing is not a release gate here — there is no CI.** Absence of failure
is not evidence of correctness.
