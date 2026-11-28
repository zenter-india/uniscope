# SOP 02: Releasing Web / Admin

**Purpose:** put what is on Preview into production for the website, the admin panel and the backend.
**Who:** Kiran approves and merges; Anusuya or Mega prepare it. Dheepan signs off for the client.
**When:** Thursdays on the release calendar (1st Thursday of the month, then alternate Thursdays; see the branching guide). The backend always ships with Web / Admin, never alone.

## Before you start
- Everything to ship is merged into `staging` and has been checked on Preview.
- Name the person who owns the after-release checks.

## A. Admin panel and backend

1. **List what is pending:**
   `git log origin/feature/flutter-migration..origin/staging --first-parent --format='%h %an | %s'`
2. **List database changes:**
   `git diff --name-status origin/feature/flutter-migration origin/staging -- backend/prisma`
   Every migration must be safe for the code running in production right now (SOP 05).
3. **Look for new settings:** check `.env.example` changes and ask Kiran to set any new variable in the Railway **production** environment before the merge.
4. **Open the release PR:** base `feature/flutter-migration`, head **`staging`**.
   The `release source` check fails for any other head branch (only `staging` or `hotfix/*` are allowed).
   Title: `Release: Web/Admin Sprint N: <headline>`.
   Description: what is included (user words), the migrations (and whether each is add-only), the risk tier, the after-merge checks.
5. **Sign-off:** Dheepan comments on the PR that the change is right from the client's side.
6. **Checks and review:** all checks green. Someone who is **not the author** approves. High-tier changes (wallet, schema) need Kiran and the other developer.
7. **Merge with "Create a merge commit".** Do **not** squash a release PR. (Releases #80 and #103 were squashed by mistake. That leaves production with commits staging does not have, so step 10 is needed.)
8. **Wait for Railway:** the backend takes about 5 to 6 minutes, the admin panel about 1.5. Do not call it done until both show **Success**.
9. **After-release checks** (the owner does these, with a test account where money is involved):
   - `https://uniscope-production.up.railway.app/health` returns OK, and the Railway deploy shows Success.
   - The admin panel loads and you can log in.
   - Open each page the release changed.
   - If the wallet or payments changed: one real top-up credits the right amount.
   - If there was a migration: it is listed in `_prisma_migrations`.
   - If a new setting was added: it is set in production.
10. **Downmerge:** if `git log origin/staging..origin/feature/flutter-migration` shows commits, open a PR **from production into `staging`** and merge it with a merge commit, so the next release does not undo anything.
11. **Paperwork:** write the release notes in `docs/releases/sprint-N-web-admin.md`; in Notion update the items (Sprint, Status Production, Go-Live date, PR link) and the release entry.

## B. Website (uniscope.in)

The website has its own branches. Release PR: base `prod/web-enrollment-site`, head `stage/web-enrollment-site`. Needs 1 approval and a green `web (build)`. Vercel deploys on merge. After: open the pages that changed, check the favicon and the Download page links, and check that a hard refresh (not a cached tab) shows the change. Never push to `prod/web-enrollment-site` directly and never copy files across by hand.

## If it goes wrong
- **Bad deploy:** in Railway, redeploy the previous successful deployment, then tell Kiran. For a code fix use SOP 04 (hotfix).
- **Migration problem:** stop and call Kiran. Do not edit the database by hand.
- **Not sure it is healthy:** do not announce the release. Fix first.

Last checked: 2026-11-28.
