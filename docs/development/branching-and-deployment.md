# Branching and deployment: how we ship Uniscope

One page the whole team follows. If this and another doc disagree, this one wins.
Last verified against GitHub and Railway: 2026-11-15.

## The cycle in 30 seconds

1. Pick a task in the Notion tracker.
2. Branch from `staging`: `feat/…`, `fix/…`, `chore/…` or `docs/…`.
3. Open a PR **into `staging`**. Fill in the PR template and name the risk tier.
4. Five automatic checks must be green, and **one teammate (not you) approves**.
5. **Squash and merge.** Railway deploys `staging` by itself.
6. Check your change on Preview (stage).
7. When Preview looks right, open a **release PR** from `staging` into production. A lead approves and merges it.
8. Railway deploys production by itself. Run the after-release checklist.

Mobile app builds and store uploads are a separate step (section 8).

## 1. Where things run

| Environment | What it is | Backend | Deploys from |
|---|---|---|---|
| **Local** | Your machine | `localhost:3001` | nothing, you run it |
| **Preview (stage)** | Test copy | `uniscope-staging.up.railway.app` | branch `staging` |
| **Production** | Real users | `uniscope-production.up.railway.app`, admin at `admin.uniscope.in` | branch `feature/flutter-migration` |

Only these three exist. Say "Preview (stage)" and "Production" everywhere (Sentry, Notion, PRs).

> **Staging shares the production database** (reported in PR #50; confirm with a lead).
> Anything you do on Preview, including a test payment or a migration, touches real data.
> Use a test account only. See section 7 for what that means for database changes.

Railway deploys the moment a commit lands on the branch. It does **not** wait for CI (`checkSuites` is off). The protection is the PR rules below, not the deploy.

**What GitHub enforces today (2026-11-15):** only the production branch, which needs 1 approval (no required checks). `staging` and the website branches have **no** rule right now, so the "5 checks + 1 approval" below is a team rule that GitHub is not yet enforcing (gap 5).

## 2. The branches

| Branch | What it is | Who merges into it |
|---|---|---|
| `staging` | Where all work lands first. Deploys to Preview (stage). | Anyone, through a PR (team rule: 5 checks + 1 approval) |
| `feature/flutter-migration` | **Production.** The name is historical. | A lead, through a release PR (GitHub enforces 1 approval) |
| `feat/…` `fix/…` `chore/…` `docs/…` | Your work. Short-lived: delete after merge. | You |
| `release/YYYY-MM-DD` | The release PR's branch, cut from `staging`. | A lead |
| `hotfix/…` | Urgent production fix, cut from production. | A lead |
| `stage/web-enrollment-site` → `prod/web-enrollment-site` | The website's own pair (section 9). | Through PRs |
| `main`, `develop` | **Do not use.** Stale. | nobody |

```mermaid
flowchart LR
  F["feat / fix / chore / docs"] -->|"PR, 5 checks, 1 approval, squash"| S["staging"]
  S -->|"auto deploy"| PV["Preview (stage)"]
  S -->|"release PR, approval, merge commit"| P["feature/flutter-migration = production"]
  P -->|"auto deploy"| PR["Production"]
  H["hotfix"] -->|"PR, approval"| P
  P -.->|"copy the fix back"| S
```

## 3. Step by step

1. **Task.** Work from a Notion item (Status "able to pick") and keep its Status current as it moves: In Testing → Stage → Production → Completed.
2. **Branch.** `git switch staging && git pull`, then `git switch -c feat/short-name`. Never commit to `staging` or production directly.
3. **Build and test locally.** Run `npm run lint --workspaces`, `npm run test --workspaces`, and for the app `flutter analyze` and `flutter test`.
4. **Open the PR into `staging`.** Title in the commit style (below). Fill in the template, set the **risk tier** from `ai/RISK_RULES.md`, and say what you tested and what you did not.
5. **Checks and review.** The five checks are: engineering rules, backend (lint, build, test), admin (build), web (build), mobile (analyze, test). Someone other than you approves. See section 5 for who.
6. **Merge.** Squash and merge (section 6). Delete the branch.
7. **Verify on Preview.** Deploys take about 5 minutes. Do your own check there and move the Notion item to Stage.
8. **Release.** A lead opens `release/YYYY-MM-DD` from `staging` into production, lists what ships, and notes any database migration. After approval it is merged with a merge commit.
9. **After the release.** Check `/health`, log in to the admin, log in with an OTP, open the app on a device. Move the Notion items to Production (and to Completed once a day of Sentry stays quiet). Watch Sentry for the first hour.

## 4. Names and messages

- **Branches:** `feat/`, `fix/`, `chore/`, `docs/`, `hotfix/` plus a short name. Example: `feat/web-wallet-topup`.
- **Commits and PR titles:** imperative, with a scope. Example: `fix(backend): handle MSG91 network failures`. Scopes: `mobile`, `backend`, `admin`, `web`, `docs`, `infra`.
- **One PR, one purpose.** Small PRs get reviewed faster.
- **Never** put a key, secret or password in a branch, a PR, a Notion item or a chat. Use Railway or Vercel variables (see CLAUDE.md, "Secrets").

## 5. Who approves what (proposed: team to confirm)

The risk tier is in `ai/RISK_RULES.md`. The author never approves their own PR.

| Tier | Examples | Who approves |
|---|---|---|
| **Low** | docs, tests, copy, formatting | any teammate |
| **Medium** | normal features, admin screens, new endpoints | any teammate |
| **High** | login or OTP, wallet and payments, database schema, notifications, native app config | a lead (Kiran) **and** the usual reviewer |
| **Critical** | production credentials, webhook signature checks, deleting data, store publishing | explicit written go-ahead from Kiran for that specific action |
| **Release to production** | any release PR | a lead (Kiran, or Dheepan when Kiran names them) |

Admin override (merging without approval) is for emergencies only. Write the reason in the PR.

## 6. How to merge

| PR | Method | Why |
|---|---|---|
| Your branch into `staging` | **Squash and merge** | One clean commit per change, easy to undo. |
| Release PR into production | **Create a merge commit** | Keeps `staging` and production history connected, so releases stop drifting apart. |
| Anything | **Not** "Rebase and merge" | It rewrites commit IDs and breaks the link between a PR and what landed. |

## 7. Database changes

Migrations run **every time the backend starts** (`prisma migrate deploy`). Because Preview shares the production database, a migration that ships to Preview is live for production users at once, before the production code changes.

- Make every migration safe for the code that is running in production **right now**.
- Add first, switch the code over, remove later (never drop or rename in one step).
- A destructive migration is **Critical** and needs Kiran's explicit approval.
- Say "migration included" in the PR title or first line.

## 8. The mobile app

- App changes go into `staging` like any other, but **users only get them in a new store build.** A merged fix is not live for app users until then.
- The version in `mobile_flutter/pubspec.yaml` is bumped by the person cutting the build. Build only from the production branch, so the store matches production.
- Builds use `scripts/build_android_release.sh` and `scripts/build_ios_release.sh`. Check that Android is signed with the release key (not debug).
- Test builds may point at Preview with `--dart-define=API_URL=https://uniscope-staging.up.railway.app/api/v1`.
- Old app builds stay in use for weeks, so the backend must keep working for them.
- Uploading to TestFlight, Play internal testing or the stores needs Kiran's explicit go-ahead each time.

## 9. The website (`web/`)

The website is deployed by Vercel from its **own two branches**:

`feat/web-…` → PR (squash) → `stage/web-enrollment-site` (Vercel preview) → release PR → `prod/web-enrollment-site` (**uniscope.in**).

- Web changes go to `stage/web-enrollment-site`, not `staging`. Do not edit `web/` on `staging` or production.
- Vercel needs a Preview-only `NEXT_PUBLIC_API_URL` pointing at the staging backend. Without it, previews talk to the **production** backend.
- Production is only updated by a release PR into `prod/web-enrollment-site`. It was last updated on 2026-10-14.

## 10. Hotfix

1. Branch `hotfix/short-name` from the production branch.
2. PR into production with one approval. Keep it as small as possible.
3. After it ships, open a PR copying the same fix into `staging`, so the next release does not undo it.

## 11. Do and don't

- **Do** keep PRs small, say what you tested, and delete merged branches.
- **Do** tell the team before a release and after it.
- **Don't** push to `staging` or production directly, paste secrets anywhere, or release late at night unless it is a hotfix.
- **Don't** merge a PR whose checks are red, or "just to see it on Preview" with a risky database change.

## 12. Known gaps (decisions for the team)

| # | Gap | Suggested fix |
|---|---|---|
| 1 | Preview shares the production database. | Give Preview its own database, then tests and migrations stop touching real data. |
| 2 | The production branch is called `feature/flutter-migration`. | Rename to `production` (needs Railway and GitHub settings changed together: a Critical, planned change). |
| 3 | The website branches have drifted far from `staging` (hundreds of commits, 24+ files in `web/`). | Move the website onto the same two-step flow, or document the website as a separate product with its own owner. |
| 4 | Railway deploys without waiting for CI. | Turn on "wait for CI" for both environments. |
| 5 | GitHub enforces only one rule: production needs 1 approval, with no required checks. `staging` had "5 checks + 1 approval" earlier this month and it is gone now; the website branches never had one. | Turn "5 checks + 1 approval" back on for `staging` and require the checks on production. Add 1 approval to both website branches. |
| 6 | Dependabot opens PRs against `main`. | Point it at `staging`, group small updates, and cap open PRs. |
| 7 | No fixed release rhythm. | Pick one (for example every Tuesday) so everyone knows when production changes. |
| 8 | No named owner for the after-release checklist. | Assign one person per release. |

Related: `ai/RISK_RULES.md`, `ai/ENGINEERING_RULES.md`, `ai/DEFINITION_OF_DONE.md`, `ai/QA.md` (release QA), `CONTRIBUTING.md`.
