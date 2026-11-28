# Systems and access

Where everything runs, who owns it, and how to get access. **Names of settings only: never
write a secret value in this file or anywhere else.**

## Environments

Only three exist. Say "Preview (stage)" and "Production" everywhere.

| Environment | Backend | Deploys from | Used for |
|---|---|---|---|
| Local | `localhost:3001` | nothing (you run it) | Development |
| Preview (stage) | `uniscope-staging.up.railway.app` | branch `staging` | Testing before release |
| Production | `uniscope-production.up.railway.app`; admin at `admin.uniscope.in`; website at `uniscope.in` | `feature/flutter-migration` (backend, admin); `prod/web-enrollment-site` (website) | Real users |

**Important:** Preview shares the **production database** (reported in PR #50, to be
confirmed). Anything you do on Preview, including a test payment or a migration, touches
real data. Use a test account and make migrations safe for the code running in production.

## Branches

| Branch | Role |
|---|---|
| `staging` | Integration branch. Feature branches land here first. Deploys to Preview. |
| `feature/flutter-migration` | **Production** for backend and admin. Planned rename to `production`. |
| `stage/web-enrollment-site` | Website preview. |
| `prod/web-enrollment-site` | Website production (uniscope.in). |
| `feat/…` `fix/…` `chore/…` `docs/…` | Short-lived topic branches, cut from `staging`. |
| `hotfix/…` | Urgent production fix, cut from production. |
| `main`, `develop` | **Stale. Do not use.** |

Full rules: [branching and deployment](../development/branching-and-deployment.md).

## Services

| Service | Used for | Where it is configured | Owner |
|---|---|---|---|
| GitHub (`zenter-india/uniscope`) | Code, PRs, CI | Repo settings, branch rules | Kiran |
| Railway | Hosts the backend (service `uniscope`) and admin panel (service `admin`), environments `staging` and `production`. Workspace "Uniscope Project", project "Uniscope Mobile". | Railway dashboard, Variables tab | Kiran |
| Vercel | Hosts the website | Vercel project settings, Environment Variables (Preview vs Production) | Kiran |
| Supabase | PostgreSQL database, file storage (verification documents, avatars), Realtime (chat ping) | Supabase dashboard; `DATABASE_URL`, `DIRECT_URL` | Kiran |
| Upstash Redis | OTP state, rate limiting | Upstash console | Kiran |
| MSG91 | SMS OTP (replaced Twilio) | MSG91 panel; provider in `backend/src/auth/otp/msg91-otp.provider.ts` | Kiran |
| Agora | Audio call transport and tokens | Agora console | Kiran |
| Razorpay | Wallet top-ups (Android, website). `uniscope.in` and `www.uniscope.in` must be registered websites. | Razorpay dashboard | Kiran |
| Apple App Store Connect, TestFlight | iOS builds, Apple In-App Purchase | Apple account | Kiran |
| Google Play Console | Android builds | Google account | Kiran |
| Firebase Cloud Messaging, APNs | Push notifications | Firebase console | Kiran |
| Sentry | Error tracking for backend and mobile. Org `amsel-gold`; projects `uniscope-backend` and `uniscope-mobile`. Environments: preview and production only. | Sentry | Kiran |
| Slack (`#uniscope`) | Team channel; the failed-sign-up alert posts here through `SLACK_WEBHOOK_URL` | Slack app settings | Kiran |
| Notion (Uniscope Board) | Tasks, bugs, releases, the Release calendar | Notion | Kiran |
| Anthropic API | The planned PR report agent (PR #52, not live yet). Needs a key scoped to a workspace with credit. | Anthropic console | Kiran |

## Getting access

1. Ask **Kiran**. He adds you to GitHub, Notion and Slack, and gives each tool the least
   access you need (read-only first).
2. **Railway, Vercel, Supabase, Razorpay, Apple, Google, Sentry:** access is granted by
   Kiran per person and per project. Do not share logins.
3. **Secrets are never sent to you.** You get working local values only through the
   process in [SOP 06](sops/06-secrets-and-access.md).
4. Record who has which access, by role and tool (not credentials), in the Notion board's
   access item. `TODO — HUMAN INPUT REQUIRED` for the current list.

## Where secrets live (names only)

- **Backend and admin (Railway):** project "Uniscope Mobile", service `uniscope` or `admin`,
  environment `staging` or `production`, Variables. The names are in `backend/.env.example`
  and `admin/.env.example`.
- **Website (Vercel):** project Environment Variables. Browser-visible values start with
  `NEXT_PUBLIC_` and must never be secrets.
- **Local:** `backend/.env`, `admin/.env.local`, `web/.env.local`. All are gitignored.
- **Mobile builds:** `--dart-define` values passed by `mobile_flutter/scripts/build_*_release.sh`
  from the build machine's environment.

## Checks and gates (CI)

Every PR must pass: engineering rules (risk tiers), backend (lint, build, test), admin
(build), web (build), mobile (analyze, test). A PR into production also needs the
**release source** check (only `staging` or `hotfix/*` may be released) and one approving
review from someone who is not the author. Railway deploys on merge and does not wait for
CI (a known gap).
