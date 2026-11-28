# Uniscope handbook for new joiners

Start here. This is the product knowledge, the standard operating procedures (SOPs) and
the knowledge-transfer (KT) toolkit for everyone who joins the Uniscope team: developers,
admin-panel operators, designers and the product side.

Last verified against GitHub, Railway and the code: **2026-11-28**.

## What Uniscope is

Uniscope is a mentorship marketplace. Prospective students (**aspirants**) talk to verified
current students and alumni (**mentors**) at real colleges: free text chat, paid fixed-slot
audio calls, and honest college reviews. Aspirants pay with an in-app wallet counted in
**Uniminutes**. There is an Android app, an iOS app (both Flutter), a NestJS backend, an
admin panel (Next.js) and a public website (Next.js) at uniscope.in.

## Where these docs live (this is what to share)

| What | Where |
|---|---|
| **Folder** | `docs/handbook/` in the GitHub repo `zenter-india/uniscope` |
| **Branch to read** | **`staging`** (the integration branch). Once PR #54 is merged, this folder is on `staging`. |
| **Until PR #54 is merged** | branch `docs/branching-and-deployment` (PR #54) |
| **Production branch** | `feature/flutter-migration`. The docs reach it with the next Web/Admin release. |
| **Do not use** | `main`. It is GitHub's default branch but stale (last commit 5 Nov 2026), so its docs are out of date. Moving the default to `staging` is a planned change (see the branching guide, section 13). |

Link to give a new joiner (after PR #54 is merged):
`https://github.com/zenter-india/uniscope/tree/staging/docs/handbook`

New joiners need access to the repo first. Ask Kiran (see [Systems and access](systems-and-access.md)).
The delivery calendar and the task board live in Notion (the **Uniscope Board**, with a
Release calendar tab). The repo is the source of truth for how things work; Notion is where
tasks and dates are tracked.

## What is in this folder

| File | What it gives you |
|---|---|
| [product-knowledge.md](product-knowledge.md) | What the product does, who uses it, the business rules that must not be broken, and what each part (apps, backend, admin, website) contains. |
| [systems-and-access.md](systems-and-access.md) | Environments, branches, every third-party service, who owns what, how to get access, where secrets live. |
| [sops/](sops/README.md) | Step-by-step procedures: making a change, PR review, releases, hotfix, database migrations, secrets, error triage, admin-panel tasks. |
| [kt-toolkit.md](kt-toolkit.md) | First-week plan, glossary, tools list, common gotchas, and a template for knowledge-transfer sessions. |
| [docs-map.md](docs-map.md) | Every older doc in the repo, and whether to trust it. |

Related, outside this folder:
[Branching and deployment](../development/branching-and-deployment.md) (the whole delivery
process) and [release notes](../releases/README.md) (one file per production sprint).

## Reading order

**Everyone (about 1.5 hours):** this page, product-knowledge, systems-and-access, kt-toolkit.

**Developers:** SOP 01 (making a change), SOP 02 (Web/Admin release), SOP 05 (migrations),
SOP 06 (secrets), then `ai/RISK_RULES.md`, `ai/ENGINEERING_RULES.md`, `ai/ARCHITECTURE.md`
and `ai/DEFINITION_OF_DONE.md`.

**Admin-panel operators and support:** product-knowledge (the admin panel section), SOP 08.

**Designers:** product-knowledge (business rules and copy rules), then the design reference
named in `CLAUDE.md` ("Design reference").

**Product and client-facing (Dheepan):** the release calendar, SOP 02 (sign-off step), and
the release notes.

## How much to trust each doc

The source code always wins. After that: this handbook, then `ai/*`, then `docs/*`.
`docs/*` is mostly from June 2026 and the product has moved on since. [docs-map.md](docs-map.md)
lists every doc with its status. Anything we could not confirm is marked
`UNKNOWN — HUMAN INPUT REQUIRED` or `TODO — HUMAN INPUT REQUIRED`. Do not guess those:
ask, and then fix the doc.

## Ground rules that apply to every page here

- **Never put a key, token, password or secret in a doc, a chat or a ticket.** Name the
  variable only. See [SOP 06](sops/06-secrets-and-access.md).
- **Use "Uniscope"**, not MedConnect, in all new text.
- **Update the doc in the same PR as the change** that makes it wrong. A stale doc is worse than none.

## Owners

| Area | Owner |
|---|---|
| Handbook as a whole, infrastructure, secrets, production deploys, store accounts | Kiran |
| Product decisions and client sign-off | Dheepan |
| Backend, admin panel, mobile, website day to day | Anusuya and Mega |
