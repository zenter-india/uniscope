# Docs map: which doc to trust

Checked on 2026-11-28 against the code and the real setup. The source code always wins.

**Status key:** **Current** (trust it), **Partly stale** (read with the notes), **Historical** (kept for context; do not follow).

Old terms you will meet and what they became: **MedConnect** is now **Uniscope**; **Expo / React Native** is now **Flutter**; **Twilio** is now **MSG91**; **Render** is now **Railway**; **Stream Chat** is now **Postgres plus Supabase Realtime**; the "single hardcoded admin login" is now a NextAuth login.

## Start here

| Doc | Status | Notes |
|---|---|---|
| `docs/handbook/` (this folder) | **Current** | Written 2026-11-28. |
| `docs/development/branching-and-deployment.md` | **Current** | The delivery process, release calendar and sprint numbers. In PR #54 until merged. |
| `docs/releases/` | **Current** | One notes file per production sprint. |

## Rules and context for engineers (`ai/`, Aug to Sep 2026)

| Doc | Status | Notes |
|---|---|---|
| `ai/RISK_RULES.md` | **Current** | Risk tiers. Use for every PR. |
| `ai/ENGINEERING_RULES.md` | **Current** | Rules any change must obey. |
| `ai/DEFINITION_OF_DONE.md` | **Current** | When work is complete. |
| `ai/PROJECT.md` | Partly stale | Good product overview. Out of date on: Twilio (now MSG91), "no CI" (CI exists), "no error tracking" (Sentry is live), the admin login, the 5-minute slot (now 6), the Android app id (now `in.uniscope.app`). |
| `ai/ARCHITECTURE.md` | Partly stale | Component detail is useful; check against code. Lists Twilio and Render. |
| `ai/SECURITY.md` | Partly stale | Sensitive surfaces are still right. Twilio, Render and Expo mentions are old. |
| `ai/QA.md`, `ai/TEST_MATRIX.md`, `ai/CALL_TEST.md` | Partly stale | Test cases and the two-device call protocol are useful. Coverage numbers are from August. |
| `ai/RELEASE.md` | Partly stale | Written before the Thursday calendar and the staging/production flow. Use the branching guide and SOPs 02 to 04. |
| `ai/AI_WORKFLOW.md`, `ai/README.md`, `ai/test-results/` | Current | Context for AI agents. |

## Long-form history

| Doc | Status | Notes |
|---|---|---|
| `CLAUDE.md` | **Current, very long** | About 600 KB. A running log of decisions, fixes and the "why" behind them. Authoritative for **why** a rule exists; search it, do not read it end to end. Its business-rules section is the best source for product decisions. |
| `AGENTS.md` | Historical | A near-duplicate of an older `CLAUDE.md`. Do not edit or trust it. |

## Product and architecture (`docs/`, mostly June 2026)

| Doc | Status | Notes |
|---|---|---|
| `docs/product/prd-v1.md` | Historical | The original June plan. The product has moved on. Use the handbook's product-knowledge instead. |
| `docs/architecture/system-architecture-v1.md` | Partly stale | Names Expo, Twilio and Render. Use `ai/ARCHITECTURE.md` and the code. |
| `docs/architecture/security-model-v1.md` | Partly stale | Principles are right; providers are old. |
| `docs/architecture/user-flows-v1.md` | Partly stale | Flows have changed (chat, calls, wallet). |
| `docs/database/domain-model-v1.md`, `erd-v1.md` | Partly stale | The schema has grown (promotions, platform on ledger entries, lead failures). The truth is `backend/prisma/schema.prisma`. |
| `docs/database/database-standards.md` | **Current** | Standards still apply: integer minor units, soft deletes, append-only ledger. |
| `docs/decisions/` (ADRs 0001 to 0003) | **Current** | Monorepo, PostgreSQL with Prisma, Flutter. |
| `docs/standards/coding-standards.md`, `naming-conventions.md` | Partly stale | Mentions Expo in places. Rules are still reasonable. |
| `docs/infrastructure/cloud-services.md`, `environment-variables.md` | Partly stale | Lists Twilio and old hosting. Use systems-and-access and the `.env.example` files. |
| `docs/development/local-setup.md`, `environment-variables.md` | Partly stale | Written for Expo. Use the kt-toolkit local commands. |
| `docs/development/branch-strategy.md` | Historical | Superseded by `branching-and-deployment.md`. |
| `docs/sprints/` (Sprint 0 and 1) | Historical | An earlier planning numbering. The release sprints (1, 2, 3, ...) are tracked in `docs/releases/` and Notion. |
| `README.md`, `CONTRIBUTING.md` | Partly stale | Repo entry points from June. They mention Expo. |

## Keeping this current

- Whoever changes behaviour updates the matching doc in the same PR.
- Each quarter, one person re-runs this check (dates, stale terms) and updates this table.
- Every stale doc should eventually get a one-line banner at the top pointing to its replacement. `TODO — HUMAN INPUT REQUIRED`: assign an owner for that clean-up.

Last checked: 2026-11-28.
