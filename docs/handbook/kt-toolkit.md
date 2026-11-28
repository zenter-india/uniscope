# KT toolkit

Everything a new joiner (and whoever hands over to them) needs to get productive:
a first-week plan, a glossary, the gotchas that cost people time, and a template for
knowledge-transfer sessions.

## First-week plan

| Day | Goal | Do |
|---|---|---|
| 1 | Access and orientation | Ask Kiran for GitHub, Notion and Slack. Read this handbook's README, product-knowledge and systems-and-access. Open the Notion **Uniscope Board** and its **Release calendar** tab. |
| 2 | Run it locally (developers) | Clone the repo. Set up `backend/.env`, `admin/.env.local`, `web/.env.local` from the `.env.example` files, with values Kiran gives you through the secure route (SOP 06). Run backend, then admin. For mobile: `flutter doctor`, then `flutter run`. |
| 3 | Learn the rules | Read SOP 01, SOP 02, `ai/RISK_RULES.md`, `ai/ENGINEERING_RULES.md`, `ai/DEFINITION_OF_DONE.md`. Read the last two release notes in `docs/releases/`. |
| 4 | Make a small change | Take a Low-tier Notion item. Branch from `staging`, make the change, open a PR into `staging`, get it reviewed, check it on Preview. |
| 5 | Teach back | Explain to a teammate: the money rules (Uniminutes, packs, holds), the branch flow, and the release calendar. Fix any doc line that confused you. |

Admin operators: replace days 2 to 4 with product-knowledge (admin panel section) and SOP 08, practised on Preview with a test account.

## Local commands

```bash
npm run dev:backend            # NestJS in watch mode (port 3001, prefix /api/v1)
npm run dev:admin              # Next.js admin (uses webpack, not Turbopack)
npm run lint --workspaces      # backend and admin
npm run test --workspaces      # backend and admin
# Mobile, from mobile_flutter/:  flutter run   flutter analyze   flutter test
# Prisma, from backend/:         npx prisma migrate deploy   (see SOP 05; do not use migrate dev)
```

Mobile against the Android emulator: `flutter run --dart-define=API_URL=http://10.0.2.2:3001/api/v1`.
For a physical device use your machine's LAN address. Local login can use a mock OTP mode:
see `backend/src/auth/otp/mock-otp.provider.ts`. Never run a backend reachable outside your
machine in mock mode.

## Tools at a glance

| Tool | Use it for |
|---|---|
| GitHub | Code, PRs, CI checks, branch rules |
| Notion, Uniscope Board | Tasks, bugs, releases, the Release calendar and schedule tabs |
| Slack `#uniscope` | Team chat and the failed-sign-up alert |
| Railway | Backend and admin hosting, deploy status, variables (Kiran) |
| Vercel | Website hosting and previews (Kiran) |
| Supabase | Database and storage (Kiran) |
| Sentry | Errors (SOP 07) |
| Razorpay, App Store Connect, Google Play Console | Payments and store builds (Kiran) |
| Claude Code | Optional coding assistant; follows `CLAUDE.md`. Never paste secrets into it (SOP 06). |

## Glossary

| Term | Meaning |
|---|---|
| **Aspirant** | A prospective student using the app to find a college and mentor. |
| **Mentor** | A verified current student or alumnus who chats and takes calls. |
| **Uniminute** | The wallet unit: 1 minute of call time = ₹10 = 1000 minor units. |
| **Minor units** | Integer paise. All money is stored this way, never as decimals. |
| **Package / top-up** | A fixed purchase of Uniminutes (₹250, ₹400, ₹750, ₹1000 on Android and web). |
| **Slot** | A prepaid call length: 6, 10 or 20 minutes. |
| **Hold** | A reservation on the wallet placed when a call is booked. It turns into a real debit only when both sides join. |
| **Ledger** | The append-only list of every wallet movement. Never edited. |
| **Idempotency key** | A unique key on a write so a retry cannot apply it twice. |
| **Alias** | A mentor's chosen display name. |
| **Lead** | A website sign-up before it becomes an account. |
| **Verification** | A mentor's college ID review by an admin. |
| **Preview (stage)** | The test environment. Shares the production database. |
| **Production** | What real users see. Branch `feature/flutter-migration` for backend and admin. |
| **Release PR** | A PR from `staging` into production. |
| **Downmerge** | A PR from production back into `staging` after a release or hotfix, so the branches stay connected. |
| **Hotfix** | An urgent production fix on a `hotfix/…` branch (SOP 04). |
| **Risk tier** | Low, Medium, High or Critical. Decides who must approve (SOP 01). |
| **Sprint** | One production release. One running number across both tracks (Web/Admin and Mobile). |
| **RLS** | Row level security on database tables. On for every table. |
| **Squash and merge / merge commit** | Squash for feature PRs into `staging`. A merge commit for release PRs. |

## Gotchas that cost people time

- **Preview shares the production database.** Test with a test account. Migrations hit production at once.
- **`main` is stale.** The GitHub default branch is not where work happens. Use `staging`.
- **The website has its own branches.** Do not edit `web/` on `staging`.
- **A merged app fix is not live** until a new store build ships.
- **Railway deploys without waiting for CI.** Watch the deploy, not just the checks.
- **Release PRs are merge commits.** Squashing them splits production from staging (SOP 02).
- **The admin dev server must use webpack** (already set in `admin/package.json`).
- **Do not trust old docs.** Check [docs-map.md](docs-map.md) first.
- **Never advertise that chat is free, and never use "match" language.** See the business rules.
- **A secret pasted in the wrong secret field** is easy to do. Check the secret's name and "updated" time.
- **Browser caches icons and pages.** After a website release, check in a private window.

## FAQ

**Who approves my PR?** Someone who is not you. The tier decides who (SOP 01).
**Why can't I merge to production?** Only `staging` or `hotfix/*` may be released, with one approval and green checks.
**Where do I record what shipped?** Release notes in `docs/releases/` and the Notion board.
**Where is the plan for what ships when?** The Notion Release calendar and the release calendar section of the branching guide.
**A doc is wrong.** Fix it in your next PR, or open a `docs/…` PR. Low tier, one review.

## Template: a knowledge-transfer (KT) session

Use this when someone leaves, changes role or hands an area to a new joiner. Record the
session and save the notes in Notion (link the recording), and fix any doc it shows is wrong.

```markdown
# KT: <area> (<from> to <to>), <date>

## Scope
What this covers and what it does not.

## The 5 things to know
1. …

## Walkthrough (screen-share the real thing)
- [ ] Where it lives (repo paths, dashboards, branches)
- [ ] How it works end to end (one real example)
- [ ] How to run and test it locally
- [ ] How it is released (which SOP)
- [ ] How to tell it is broken (Sentry, logs, alerts)
- [ ] The last three incidents or surprises

## Access needed (names of tools and roles, never credentials)

## Open risks and known gaps

## Teach-back
The new owner explains it back, and makes one small change or runs one operation with the old owner watching.

## Follow-ups
- [ ] Doc fixes (link the PRs)
- [ ] Access granted or removed (Kiran)
```

## Who to ask

| Question | Ask |
|---|---|
| Access, infrastructure, secrets, production, store accounts | Kiran |
| What to build and in what order, client sign-off | Dheepan |
| Backend, admin, website, mobile code | Anusuya or Mega |

Last checked: 2026-11-28.
