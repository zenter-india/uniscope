# PR report agent

Every non-draft, same-repo pull request gets an automatic, **read-only** report:
a risk tier (from `ai/RISK_RULES.md`), mechanical checks, and an AI review. It is
posted as one sticky PR comment, and optionally to Slack and Notion. It **never
approves, merges or pushes**; a human decides.

## What a report contains
- **Risk tier** LOW / MEDIUM / HIGH / CRITICAL and the approval that tier needs.
  Worked out by `scripts/pr-report/risk-rules.mjs` from paths and diff content
  (migrations, auth, wallet, calling, notifications, native code, env/config,
  throttling, dependency majors, removed guards, destructive SQL).
- **Mechanical checks**: merge conflicts against the base, migrations, env/config
  changes, dependency changes, secret-looking values in added lines (names only,
  never values), test evidence, CI status so far.
- **AI review** (`.claude/agents/pr-reviewer.md`): verdict, findings with
  `file:line`, and what could not be verified.

## How it is wired
| Part | File | Has secrets? |
|---|---|---|
| Collect facts | `scripts/pr-report/collect.mjs` | No |
| AI review (strict read-only allowlist, one writable file) | `.github/workflows/pr-report.yml`, `.claude/agents/pr-reviewer.md` | Only `ANTHROPIC_API_KEY` |
| Publish (PR comment, Slack, Notion) | `scripts/pr-report/publish.mjs` | Slack + Notion only |

The AI step never sees the Slack or Notion credentials, and it has no network
tools, so a malicious PR cannot make it leak them. Posting is plain code. The
review is skipped (the mechanical report still posts) when there is no API key,
for `release/*` PRs, and for PRs over 150 files.

## One-time setup (done by a repo admin in GitHub, never in chat)
GitHub → Settings → Secrets and variables → Actions.

| Name | Kind | What it is | Required? |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Secret | Anthropic API key for the AI review | For the AI review |
| `SLACK_PR_WEBHOOK` | Secret | A Slack Incoming Webhook URL for the channel that gets reports | For Slack |
| `NOTION_TOKEN` | Secret | Token of a Notion internal integration that has been shared with the PR Reports database | For Notion |
| `NOTION_PR_REPORTS_DB` | Variable | The PR Reports database id (not secret) | For Notion |

With none of them set, every PR still gets the mechanical report as a comment.

### Notion "PR Reports" database
Columns (names and types must match): `Name` (title), `PR` (number), `Risk`
(select), `Verdict` (select), `Author` (text), `Branch` (text), `URL` (url),
`Updated` (date). One page per PR; a new push replaces that PR's page.

## Slack noise control
Posted for every opened / reopened / ready-for-review PR. For later pushes, only
HIGH and CRITICAL PRs post again.

## Run it by hand
```bash
# facts for any PR (needs gh logged in)
PR_NUMBER=50 BASE_SHA=$(gh pr view 50 --json baseRefOid -q .baseRefOid) \
HEAD_SHA=$(gh pr view 50 --json headRefOid -q .headRefOid) \
node scripts/pr-report/collect.mjs --out pr-report
# preview what would be posted, without posting
node scripts/pr-report/publish.mjs --dir pr-report --dry-run
```
Or ask Claude Code: "use the pr-reviewer agent on PR 50".

## Where it runs
There is no server to host. It runs as a GitHub Actions job (`.github/workflows/pr-report.yml`)
on a GitHub-hosted `ubuntu-latest` runner, started by each PR event
(opened, reopened, ready for review, new push). It calls the Anthropic API for the
review and posts to GitHub, Slack and Notion. Logs are in the repo's Actions tab.
It uses a few minutes of GitHub Actions time per run. It can also be run on demand
from Claude Code ("use the pr-reviewer agent on PR 50").

## Cost
The AI review uses `claude-sonnet-5-5` ($2 / $10 per million input / output tokens,
cached reads $0.20). Estimated about $0.10 (small PR) to $0.35 (large PR) per review,
roughly $10-25 a month at the current PR volume. `CLAUDE.md` (about 150k tokens) is
excluded in CI because loading it would add roughly $0.65-0.75 to every review.
Every report ends with the real cost of its AI review. Set a monthly spend limit on
the API key in the Anthropic console as a hard cap.

## Limits and trust
- Runs on the `pull_request` event, so it uses the workflow from the PR itself.
  That is fine while only trusted collaborators can push branches; forks and
  Dependabot are skipped. If outside contributors are ever allowed, move the
  scripts to a base-branch-pinned workflow first.
- The AI review is a second pair of eyes, not an approval. HIGH and CRITICAL
  tiers still need a named human, per `ai/RISK_RULES.md`.
- Each run of the AI review costs API usage; a push re-runs it.
- It cannot test authenticated admin pages, real devices or production data.
