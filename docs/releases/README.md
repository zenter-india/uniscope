# Release notes

One file per production sprint, named `sprint-<N>-<track>.md`, for example
`sprint-3-web-admin.md` or `sprint-5-mobile.md`. The calendar and the numbering
rules are in [Branching and deployment](../development/branching-and-deployment.md#release-calendar-and-sprint-numbers).

| Sprint | Track | Date | Notes |
|---|---|---|---|
| 1 | Web / Admin | (before this folder) | Not written up here |
| 2 | Mobile (iOS and Android) | (before this folder) | Not written up here |
| 3 | Web / Admin | Thu 26 Nov 2026 | [sprint-3-web-admin.md](sprint-3-web-admin.md) |

Add a row when a sprint ships. If a Thursday has no release, add a row that says
"no release" and the reason, and keep the numbering going.

## Template

Copy this into `sprint-<N>-<track>.md`. Write it for the whole team and for
Dheepan: plain words, no PR jargon, what a person would notice.

```markdown
# Uniscope release notes: <Web/Admin | Mobile> Sprint <N>

**Released:** <day, date> (release PR #<n>)
**Covers:** <what was merged to staging since the last release of this track>
**Affects:** <admin / website / backend API / iOS app / Android app>

## New
- **<Feature>** (<tracker id>): what it does for the person using it.

## Improved
- <A change that makes something better or clearer.>

## Fixed
- <What was wrong and what happens now.>

## Behind the scenes
- **Database:** <migrations, and whether each is add-only>.
- **Settings:** <any new or changed environment variable, by name only>.
- **Other:** <anything else the team should know>.

## Not in this release
- <Things people may expect but that are not here, and why.>

## Known gaps
- <Open problems we know about, with a workaround.>

## After-release checks
- [ ] Backend health is OK and the Railway deploy shows Success.
- [ ] <The pages or flows this release changed.>
- [ ] <For wallet changes: one real top-up credits correctly.>
- [ ] <For database changes: migrations present in `_prisma_migrations`.>
```

Rules for the notes:

- Name settings by variable name only. Never write a key, token or secret value.
- Say what is **not** verified. If you did not check something, say so.
- Mobile notes also give the store build numbers (version and build) and whether the
  backend it needs was already live.
