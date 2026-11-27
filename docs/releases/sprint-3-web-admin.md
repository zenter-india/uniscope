# Uniscope release notes: Web/Admin Sprint 3

**Released:** Thu 26 Nov 2026 (release PR #103, staging into production)
**Covers:** everything merged to staging since the 20 Nov release (#87)
**Affects:** admin panel (admin.uniscope.in) and the backend API. The website and the
mobile apps are not part of this release. The website changes are waiting in PR #76.

## New

**Money page (admin, UNI-17)**
- Money coming in, split by platform: iOS, Android and Web.
- Top-ups, trends over time, and who the paying users are.
- Real rupee amounts for iOS purchases.
- Download top-ups and mentor earnings as a CSV file.
- Apple test purchases and refunds are left out, so the page counts real money only.

**Account creation page (admin, UNI-51)**
- Lists website sign-ups that never got an account, with the **reason** and the **step**
  where it stopped (creating the account, sending the college ID, or linking it back).
- **Export CSV** for the sign-ups that need attention.
- The team gets a **Slack alert** when a website sign-up fails to create an account.
- The "Retry account" button is removed from this page.

**Website sign-up approvals**
- A course and specialization typed by a visitor is now queued for admin approval.
- When approving a profile, admins pick an **existing specialization name from a
  dropdown** (UNI-72), which avoids duplicate spellings.

## Improved
- The Money page has fewer tabs: Balances, Mentors and Usage were removed.
- Wallet top-ups now record where they were made (Android, iOS or Web). This is a label
  for reporting only. Credit amounts and prices did not change.

## Behind the scenes
- **Database:** 3 add-only migrations: a platform label on wallet ledger entries
  (`20261124160000_add_ledger_entry_platform`), and the failure reason, time and step on
  website sign-ups (`20261126120000_add_lead_account_failure`,
  `20261126150000_add_lead_account_failure_step`). Existing data is untouched.
- **Settings:** the failed-sign-up alert uses the existing `SLACK_WEBHOOK_URL`. It does
  nothing if that is not set in production.
- **Android:** the manifest marks Wi-Fi hardware as optional so Google Play does not
  restrict devices. It takes effect only in the next store build.

## Not in this release
- **UNI-71** (shared typed specializations): added in #89, reverted in #90, and replaced
  by UNI-72 (#91).
- **Website changes** (Sign up layout on phones, the bundled Manrope font, the mentor
  wallet notice): PR #76, still waiting for its review.

## Known gaps
- If sending a promotion **with a credit** fails partway, sending it again can credit
  people twice. A fix is planned. Until then, check the Promotions history before
  resending any credit promotion.
- Merged without a recorded approving review (GitHub shows none on #103).
- Merged as a **squash** commit, but release PRs are meant to be merge commits (branching guide, section 6). Production now has commits `staging` lacks, so a downmerge PR from production into `staging` is still to do (SOP 02, step 10). Release #80 was squashed the same way.

## After-release checks
- [ ] Backend health is OK and the Railway deploy shows Success.
- [ ] Money page and Account creation page load.
- [ ] One real wallet top-up credits correctly and shows its platform.
- [ ] Approving a profile shows the specialization dropdown.
- [ ] `SLACK_WEBHOOK_URL` is set in production, so the failed-sign-up alert reaches Slack.
- [ ] The 3 migrations are present in `_prisma_migrations`.

Not verified when this was written: that the deploy finished, and that the migrations are
applied.
