# AI WORKFLOW — how UniScope plugs into the Asytellex AI Engineering OS

**UniScope provides project context. UniScope does not implement agents.**

The Planner, Builder, Reviewer, QA, Risk, and Release agents live centrally in
the Asytellex AI Engineering OS and operate across many projects. This
repository is a **context provider** and a **constraint source** — nothing more.

---

## Architecture position

```
                 ASYTELLEX AI ENGINEERING OS
                            |
                   GENERIC COMMAND ROUTER
                            |
              +-------------+-------------+
              |                           |
        UNISCOPE PROJECT            OTHER PROJECTS
           CONTEXT                     CONTEXT
        (this /ai/ package)                |
              +-------------+-------------+
                            |
                    GENERIC AI AGENTS
                            |
        PLANNER -> BUILDER -> REVIEWER -> QA -> RISK -> RELEASE
                            |
                          GitHub
                            |
                            CI
                            |
                         Staging
                            |
                    HUMAN APPROVAL
                            |
                        Production
```

UniScope sits **only** in the "PROJECT CONTEXT" box.

---

## Do not build here

Explicitly out of scope for this repository, permanently:

- An AI orchestrator, command router, or agent framework
- UniScope-specific Planner / Builder / Reviewer / QA / Risk / Release agents
- Gumloop SDK integration, n8n, or any workflow engine
- A VPS requirement or any always-on agent service
- A device farm, emulator fleet, or mobile-device automation platform

If a task appears to require any of these **inside this repository**, that is
a signal the task is misrouted. Surface it rather than building it.

---

## Intended end-to-end workflow

| # | Stage | Owner | UniScope's contribution |
|---|---|---|---|
| 1 | Human request | Human | — |
| 2 | Generic Command Router | OS | — |
| 3 | Project identification | OS | Repository identity: `uniscope` |
| 4 | Project context loading | OS | **This `/ai/` package** |
| 5 | Generic Planner | OS | `PROJECT.md`, `ARCHITECTURE.md`, `ENGINEERING_RULES.md` |
| 6 | Risk classification | OS | **`RISK_RULES.md`** — the tiering source |
| 7 | Human approval when required | Human | Thresholds from `RISK_RULES.md` |
| 8 | Generic Builder | OS | `ENGINEERING_RULES.md`, `SECURITY.md` constraints |
| 9 | GitHub branch | OS | Branch conventions (below) |
| 10 | CI | OS | **None exists** — see `ARCHITECTURE.md` |
| 11 | Generic Reviewer | OS | `ENGINEERING_RULES.md`, `SECURITY.md` |
| 12 | QA | OS | `QA.md`, `TEST_MATRIX.md` |
| 13 | Manual device QA when required | Human | **`CALL_TEST.md`** |
| 14 | Evidence collection | Human → OS | `test-results/TEMPLATE.md` |
| 15 | AI diagnosis if failed | OS | Evidence records + `ARCHITECTURE.md` failure modes |
| 16 | Fix cycle | OS | Re-enters at step 5 |
| 17 | Staging | OS | **Does not exist for the backend** — see below |
| 18 | Release readiness | OS | `DEFINITION_OF_DONE.md`, `RELEASE.md` |
| 19 | Human approval | Human | Mandatory, always |
| 20 | Production | OS + Human | `RELEASE.md` |

---

## Where the generic workflow does not fit UniScope

An honest statement of friction, so the OS does not assume capabilities that
are absent:

**Step 10 — CI does not exist.** No `.github/workflows/`. A generic agent
expecting a CI verdict will get nothing. Treat "no CI signal" as *unknown*,
never as *pass*. The available substitutes must be run explicitly (see
`QA.md` § Automated QA).

**Step 17 — there is no staging backend or staging database.** The API has
local and production only. A "deploy to staging, verify, then promote" step
has no target. Only `web/` has a genuine staging path
(`stage/web-enrollment-site` → Vercel preview).

**Step 13 — manual device QA is a hard human dependency.** Audio calling,
push, permissions, and payments cannot be verified by any agent in any
sandbox. The generic OS must be able to **block on a human** and resume when
evidence lands in `ai/test-results/`.

**Step 15 — diagnosis inputs are thin.** No crash reporting, no client-side
call logging, no correlation IDs across mobile/backend/Agora. A failed call
produces almost no machine-readable evidence, which is why
`CALL_TEST.md` § Failure information specifies human-captured evidence in such
detail. Improving this is the highest-leverage change available for AI
diagnosability (see `ai/README.md` and the recommendations in the final report).

---

## Branch conventions

| Pattern | Purpose |
|---|---|
| `main` | Default branch; **not** the deploy source for `web` |
| `prod/<surface>` | Production source (e.g. `prod/web-enrollment-site`) |
| `stage/<surface>` | Staging source; Vercel preview deploys |
| `feature/<name>` | Feature work |

Agents should branch from the relevant `stage/` branch where one exists, and
never push directly to a `prod/` branch without human approval.

Note: commits must carry an author email resolving to a GitHub account, or
Vercel blocks the deployment before building.

---

## What an agent should load, and when

| Task type | Minimum context |
|---|---|
| Any task | `PROJECT.md`, `ENGINEERING_RULES.md`, `RISK_RULES.md` |
| Backend change | + `ARCHITECTURE.md` (BACKEND), `SECURITY.md` |
| Mobile change | + `ARCHITECTURE.md` (MOBILE/ANDROID/IOS) |
| Calling change | + `ARCHITECTURE.md` (REAL-TIME), **`CALL_TEST.md`**, `TEST_MATRIX.md` CALL-* |
| Wallet/billing | + `SECURITY.md`, `TEST_MATRIX.md` WALLET-* |
| Auth change | + `SECURITY.md`, `TEST_MATRIX.md` AUTH-*/AUTHZ-* |
| Release | + `RELEASE.md`, `DEFINITION_OF_DONE.md` |
| Diagnosing a failure | + relevant `test-results/` records, `ARCHITECTURE.md` failure modes |

---

## Machine-consumable surfaces

What a generic agent can reliably extract from this repository today:

**Structured, stable:**
- Risk tiers and approval thresholds (`RISK_RULES.md`)
- Test case IDs with preconditions, steps, expected results, device
  requirements, and risk levels (`TEST_MATRIX.md`)
- Data classification: SAFE / SENSITIVE / SECRET (`SECURITY.md`)
- Forbidden autonomous actions (`SECURITY.md`)
- Completion criteria (`DEFINITION_OF_DONE.md`)
- Evidence schema (`test-results/TEMPLATE.md`)

**Derivable from source:**
- Prisma schema — full data model, enums, constraints
- NestJS DTOs + `class-validator` decorators — request contracts
- `toXResponse()` projections — response contracts
- go_router route table — mobile navigation graph
- `.env.example` — required configuration, with placeholders only

**Not available, and must not be fabricated:**
- CI results (no CI)
- Crash/error telemetry (no SDK)
- Call quality or connection metrics (no instrumentation)
- Staging verification (no staging backend)
- Any test status not backed by a `test-results/` record

---

## Interaction rules for agents

1. **Load context before planning.** Do not infer this project's architecture
   from generic mobile-app assumptions; several parts are unusual (compile-time
   API URL, vendored Agora AAR, request/accept calling with no ringing model).
2. **The code is authoritative** where it disagrees with documentation, and the
   drift should be fixed as part of the change.
3. **Respect the approval thresholds.** A general "go ahead" never covers a
   CRITICAL action.
4. **Never fabricate a test result or a status.** `UNKNOWN` and `BLOCKED` are
   correct, useful answers.
5. **Surface misrouted work** rather than building agent infrastructure here.
6. **Ask when a locked-in business rule appears to be in the way.** Several
   were reversed once already; silently re-reversing one is a known failure
   mode in this project's history.
