# /ai — UniScope Project Context Package

Machine-readable and human-readable **project-specific** context for generic
AI engineering agents (the Asytellex AI Engineering OS).

## What this directory is

This directory holds **only UniScope-specific knowledge**: what this codebase
actually is, how it is actually built, what is genuinely risky to touch, and
how to test and release it.

## What this directory is NOT

This directory does **not** contain AI agents. There is no Planner, Builder,
Reviewer, QA, Risk, or Release implementation here, and none should be added.
Those agents live centrally in the Asytellex AI Engineering OS and operate
across many projects. This repository is a **context provider**, not an
orchestrator.

Concretely, do not add to this repository:

- an AI orchestration server or framework
- n8n, or a VPS requirement
- a device farm or emulator automation platform
- UniScope-specific copies of the generic agents

## Reading order for an agent

| Order | File | Purpose |
|---|---|---|
| 1 | [PROJECT.md](PROJECT.md) | What UniScope is; roles, journeys, modules |
| 2 | [ARCHITECTURE.md](ARCHITECTURE.md) | How it is actually built, per component |
| 3 | [ENGINEERING_RULES.md](ENGINEERING_RULES.md) | Rules any change must obey |
| 4 | [RISK_RULES.md](RISK_RULES.md) | Risk tier → approval requirement |
| 5 | [SECURITY.md](SECURITY.md) | Sensitive surfaces; forbidden autonomous actions |
| 6 | [QA.md](QA.md) | Test strategy and current coverage reality |
| 7 | [TEST_MATRIX.md](TEST_MATRIX.md) | Enumerated test cases with IDs |
| 8 | [CALL_TEST.md](CALL_TEST.md) | The manual two-device audio-call protocol |
| 9 | [DEFINITION_OF_DONE.md](DEFINITION_OF_DONE.md) | When work is actually complete |
| 10 | [RELEASE.md](RELEASE.md) | How builds ship (and what is unknown) |
| 11 | [AI_WORKFLOW.md](AI_WORKFLOW.md) | How this repo plugs into the generic OS |

Test evidence goes in [test-results/](test-results/), using
[test-results/TEMPLATE.md](test-results/TEMPLATE.md).

## Relationship to existing repository documentation

This package **references rather than duplicates** existing docs:

- `CLAUDE.md` / `AGENTS.md` (repo root) — long-form working history and
  locked-in product decisions. Authoritative for *why* decisions were made.
  Note: these two files are near-identical duplicates of each other, and
  parts are stale (see `ARCHITECTURE.md` § Documentation drift).
- `docs/` — architecture, database, decisions (ADRs), development setup.
- `README.md`, `CONTRIBUTING.md` — repository entry points.

Where this package and those documents disagree, **the source code wins**,
and the discrepancy should be recorded in `ARCHITECTURE.md`.

## Convention used throughout

Any statement that could not be established from the repository is marked:

```
UNKNOWN — HUMAN INPUT REQUIRED
```

or, for process gaps:

```
TODO — HUMAN INPUT REQUIRED
```

Agents must treat these as blockers to be surfaced, never as gaps to fill by
guessing.

---

Last verified against the repository: 2026-08-13.
Verification commit: see `git log -1` at time of reading.
