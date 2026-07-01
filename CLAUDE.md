# Uniscope — Working Guide for Claude Code

> This file is loaded automatically by every Claude Code instance on this repo.
> It is shared by the whole team — keep it accurate and concise.

## Project

**Uniscope** is an anonymous mentorship marketplace connecting prospective medical
students with verified current students, alumni, and mentors from medical
universities. Users discover universities, read reviews, find mentors, chat 1:1,
and pay per-minute for mentor sessions via an in-app wallet.

> **Naming:** The product was renamed **Uniscope → Uniscope**. The repo, root
> `package.json`, and recent commits use Uniscope; much of `docs/` still says
> Uniscope. **Use "Uniscope" in all new code, copy, and docs.** A repo-wide
> doc rename is a pending chore — until then, treat Uniscope as a legacy alias.

## Team & roles

Four people build this app together; **each works through their own Claude Code instance.**

| Person | Role | Owns |
|--------|------|------|
| **Kiran Raj** | Project owner / technical lead | All cloud infra & secrets, prod deploys, integration review, admin portal |
| **Hari** | Developer | Backend (`backend/`) |
| **Anusuya** | Developer | Mobile (`mobile/`) |
| **Apoorva** | UI/UX designer | Design tokens & screen specs |

## Repo map (npm workspaces, Node ≥20)

| Path | Stack | State |
|------|-------|-------|
| `backend/` | NestJS 11 + Prisma 7 + PostgreSQL | Auth ~70%; most feature modules empty |
| `mobile/` | **Flutter (Dart)** | **Migrating from Expo/React Native → Flutter.** Old RN code archived/being replaced |
| `admin/` | Next.js 16 (App Router) + Tailwind 4 | Skeleton home page only |
| `docs/` | Product, architecture, standards, sprints, ADRs | Comprehensive |
| `infrastructure/` | Cloud config (Docker compose is **deprecated**) | Cloud-first |

DB schema is **complete** — 14 entities, marketplace-ready (User, UserProfile,
University, Program, MentorProfile, MentorVerification, Review, Wallet,
LedgerEntry, PaymentOrder, Session, SessionRating, Block, Report, Notification).

## Ownership split (avoid Claude-instance collisions)

Stay within your owner's track unless you coordinate first. This prevents two
Claude instances editing the same files and creating merge conflicts.

- **Hari → Backend** (`backend/src/**`): harden auth, then build empty modules in
  dependency order — verification → reviews → chat gateway (Stream) →
  notifications (FCM) → reports → marketplace (wallet/ledger/payments/sessions).
- **Anusuya → Mobile** (`mobile/lib/**`, Flutter): rebuild the app in Flutter —
  auth flow wired to live endpoints, university discovery, mentor discovery, chat
  UI (Stream), wallet/recharge, verification upload, profile editing. Enable
  `flutter analyze` / `dart format` in CI.
- **Kiran → Admin + Infra + Integration** (`admin/**`, `infrastructure/**`,
  CI/CD, deploys): NextAuth login, dashboard, verification/moderation/user/
  university queues; GitHub Actions; Render/EAS releases; cross-cutting review.
- **Apoorva → Design**: owns the Flutter `ThemeData` / design tokens (e.g.
  `mobile/lib/theme/`) and screen specs; hands specs to Anusuya.

**Coordinate-first files** (announce in team channel before editing):
`backend/prisma/schema.prisma`, root `package.json`, any `*/.env.example`,
`mobile/src/types/navigation.ts`, `docs/sprints/**`.

## Conventions

- **Branches:** branch from `develop` (integration branch); `main` is production.
  Prefixes `feature/ | bugfix/ | hotfix/`. See `docs/development/branch-strategy.md`.
- **Commits:** imperative subject, scopes `mobile | backend | admin | docs | infra`,
  e.g. `feat(backend): add verification review queue`. See `CONTRIBUTING.md`.
- **PRs:** small and focused, fill the PR template, ≥1 review, **squash-merge**.
- **Code** (`docs/standards/coding-standards.md`, `docs/database/database-standards.md`):
  - TypeScript strict; **no `any`** in auth or navigation code.
  - **Money is integer paise** (₹0.01 units) — never floats.
  - **Phone numbers hashed** (bcrypt), never stored plaintext.
  - **Soft-delete** mutable entities via `deletedAt`.
  - LedgerEntry is **append-only**; use `idempotencyKey` for exactly-once billing.
- **Env vars:** update the matching `.env.example` whenever you add/change a var.
  **Infra secrets are owned by Kiran** — devs consume via env only, never commit secrets.
- **Definition of Done:** `npm run lint --workspaces` and `npm run test --workspaces`
  both exit 0.

## Cloud services (all owned/provisioned by Kiran)

| Service | Provider | Use |
|---------|----------|-----|
| Database + Storage | Supabase PostgreSQL | Primary data store, file/avatar/doc storage |
| Cache / OTP store | Upstash Redis | OTP, sessions, presence |
| OTP delivery | Twilio Verify | SMS OTP |
| Backend hosting | Render | Auto-deploy from GitHub |
| Mobile builds | Flutter (Codemagic / fastlane) | iOS / Android builds — Expo EAS retired with the RN→Flutter switch |
| Push | Firebase FCM + APNs | Notifications |
| Chat | Stream Chat | 1:1 messaging, presence |
| Payments | Razorpay | Wallet recharge, session billing |

## Local commands

```bash
npm run dev:backend          # NestJS watch (port 3000)
npm run dev:admin            # Next.js (port 3001 per launch.json)
npm run lint --workspaces    # lint backend + admin
npm run test --workspaces    # test backend + admin
# Mobile (Flutter, in mobile/): flutter run / flutter analyze / flutter test
# Prisma (in backend/): npx prisma migrate dev / npx prisma db seed
```

> **Mobile stack note:** `mobile/` is **Flutter**, not part of npm workspaces.
> It is built and tested with the Flutter toolchain, not `npm`. Requires the
> Flutter SDK installed locally (`flutter doctor`).

## 30-Day Full-MVP roadmap

Aggressive target: ship the full marketplace MVP to production in ~30 days.

- **Week 1 — Foundation hardening + Flutter scaffold:** finish backend auth
  end-to-end (OTP rate limiting, token refresh), universities list/detail, admin
  login. **Scaffold the Flutter app** (`flutter create`, project structure, state
  mgmt e.g. Riverpod/Bloc, Dio HTTP client, secure token storage) and re-implement
  the auth flow + auth gate in Flutter. Stand up GitHub Actions CI. First staging
  deploy to Render. Seed universities.
- **Week 2 — Identity & discovery:** mentor profiles + discovery (API + mobile),
  verification upload + admin review queue, reviews create/list, profile editing +
  avatar upload.
- **Week 3 — Chat & money:** Stream Chat (backend channel provisioning + mobile UI),
  wallet + ledger + Razorpay recharge, billable sessions (rate snapshot, billed
  seconds, commission), FCM notifications.
- **Week 4 — Moderation, hardening, release:** reports/moderation queue, admin
  metrics, security pass (CORS/helmet/rate limits), E2E smoke tests, EAS production
  build, prod deploy + checklist.

**Risk / cut line:** payments + billable sessions + chat are the heaviest, most
edge-case-prone integrations. If Week 3 slips, **cut wallet/payments/sessions**
and ship a lean MVP (auth + discovery + reviews + chat + verification), then
fast-follow payments. Testing is at 0% — land CI + auth/billing unit tests in
Week 1, do not defer. **The RN→Flutter rewrite resets mobile to ~0%** and adds
meaningful cost against the 30-day target — the existing Expo/RN screens are
reference only, not reusable code; budget Week 1–2 mobile capacity for the rebuild.

## Rules for Claude

1. Stay within your owner's track; coordinate before touching shared files above.
2. Never touch or print infra secrets; never commit `.env`.
3. Use "Uniscope" in new code/copy; don't propagate "Uniscope".
4. Always update the relevant `.env.example` when env vars change.
5. Follow branch/commit/PR conventions; commit or push only when asked.
