# SOP 04: Hotfix

**Purpose:** fix something broken in production without waiting for the next Thursday.
**Who:** any developer; Kiran approves. **When:** production is broken or at risk and the fix is small.

A hotfix does not get its own sprint number. Record it in the notes of the next sprint.

## Steps (backend and admin)
1. Branch `hotfix/short-name` from the **production** branch (`feature/flutter-migration`).
2. Make the smallest possible fix. No extras.
3. Open a PR into production. The `release source` check allows `hotfix/*` branches. It needs one approval from someone who is not the author.
4. Merge, then wait for Railway to show Success and run the checks in SOP 02, step 9, for what you touched.
5. **Copy the same fix into `staging`** (a PR from production into `staging`, or the same change as a PR), so the next release does not undo it.
6. Note it in the next sprint's release notes and in Notion (Type "Hot Fix").

## Steps (website)
Branch `hotfix/web-<name>` from `prod/web-enrollment-site`, PR into it (1 approval, green `web (build)`). An example is PR #74, which restored the Google Play link. Copy the fix into `stage/web-enrollment-site` afterwards.

## Check it worked
The thing that was broken works on the live site, and nothing next to it broke.

## If it goes wrong
Redeploy the previous good deployment in Railway or Vercel, and tell Kiran.

Last checked: 2026-11-28.
