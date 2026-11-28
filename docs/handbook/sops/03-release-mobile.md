# SOP 03: Releasing Mobile (iOS and Android)

**Purpose:** publish a new Android and iOS build to the stores.
**Who:** the developer cutting the build, with Kiran, who owns the store accounts.
**When:** the Thursday **after** a Web / Admin release, so the backend the app needs has been live for a week.

Users only get app changes in a **new store build**. A merged fix is not live for app users until then.

## Before you start
- The backend and admin changes the app depends on are already live and healthy (SOP 02).
- Old app builds stay in use for weeks, so the backend must keep working for them.
- You have **Kiran's explicit go-ahead** to upload. Uploading to TestFlight, Play internal testing or the stores needs it every time. This is a Critical-tier action.

## Steps
1. Build from the **production** branch, so the store matches production.
2. Bump the version in `mobile_flutter/pubspec.yaml` (version and build number). Note both in the release notes.
3. Run `flutter analyze` and `flutter test`.
4. Build with the scripts: `mobile_flutter/scripts/build_android_release.sh` and `mobile_flutter/scripts/build_ios_release.sh`. They take their values from the build machine's environment (`--dart-define`); never paste them into a file or chat.
5. **Android:** check the build is signed with the **release** key, not debug.
6. **iOS:** keep the Apple rules in mind. Wallet top-ups on iOS must use Apple In-App Purchase (App Store guideline 3.1.1). Do not add a link or text that sends iOS users to buy elsewhere.
7. Test on a real device against Production: login, one chat, wallet screen, and anything this release changed. Test builds may point at Preview with `--dart-define=API_URL=https://uniscope-staging.up.railway.app/api/v1`.
8. Upload (TestFlight / Play internal testing first) after Kiran's go-ahead. Release to the stores only after the test build looks right.
9. Write `docs/releases/sprint-N-mobile.md` (version and build numbers, what changed, which backend release it needs) and update the Notion board.

## Check it worked
The new build shows in TestFlight or Play internal testing; a tester installs it and passes the test in step 7. After store approval, the version shows in the store.

## If it goes wrong
Stop the rollout in the store console if it is still staged, and tell Kiran. A store build cannot be recalled; the fix is a new build.

## Gaps to fill
`TODO — HUMAN INPUT REQUIRED`: the exact store console steps and review-note checklist, who holds each store login, and whether staged rollout is used. Kiran to supply, then add here.

Last checked: 2026-11-28.
