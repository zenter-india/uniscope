# SOP 01: Making a change and getting it reviewed

**Purpose:** get a change from an idea to Preview safely.
**Who:** any developer. **When:** every change.

## Before you start
- Pick a task in the Notion **Uniscope Board**. Put its ID in the branch name, for example `feat/UNI-34-web-wallet`.
- Decide the **risk tier** (`ai/RISK_RULES.md`). A change takes the highest tier any part of it touches. When unsure, go one tier up.
- Website changes (`web/`) go to `stage/web-enrollment-site`, **not** `staging`.

## Steps
1. Branch from `staging`: `feat/…`, `fix/…`, `chore/…` or `docs/…`.
2. Make the smallest change that does the job. Touch only the files the task needs.
3. Run the checks locally: `npm run lint --workspaces` and `npm run test --workspaces`
   (backend and admin); for mobile, from `mobile_flutter/`: `flutter analyze` and `flutter test`.
4. If you changed behaviour, test it against the real running backend, not only the type checker.
5. If you added or changed an environment variable, update the matching `.env.example`. If you changed a schema, follow SOP 05.
6. Open a PR **into `staging`**. Fill in the PR template. Name the risk tier. Say "migration included" if one is.
7. Wait for the checks to pass: engineering rules, backend, admin, web, mobile.
8. Get approval (table below). **The author never approves their own PR.**
9. **Squash and merge.** Railway deploys `staging` by itself.
10. Check your change on Preview with a test account. Update the Notion item (status Stage, PR link).

## Who approves

| Tier | Examples | Approver |
|---|---|---|
| Low | docs, tests, copy, formatting | the other developer |
| Medium | normal features, admin screens, new endpoints | the other developer |
| High | login or OTP, wallet and payments, schema, notifications, native app config | Kiran **and** the other developer |
| Critical | production credentials, webhook signature checks, deleting data, store publishing | explicit written go-ahead from Kiran for that specific action |

If a developer's own PR is the only one open, Kiran reviews it.

## Rules
- **Never merge your own PR by using the admin override.** It is for emergencies only, with the reason written in the PR.
- Merge methods: feature PR into `staging` = squash. Release PR into production = **merge commit**. Never "Rebase and merge".
- Never commit a secret, a `.env` file, or a real phone number.

## Check it worked
The PR is merged, the Preview deploy is healthy (`https://uniscope-staging.up.railway.app/health`), and your change works there.

## If it goes wrong
Revert the squash commit with a new PR into `staging`. Migrations that already ran are not reverted by a code revert; tell Kiran (SOP 05).

Last checked: 2026-11-28.
