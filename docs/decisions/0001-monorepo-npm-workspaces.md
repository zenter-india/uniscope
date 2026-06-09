# ADR 0001: Monorepo with npm workspaces

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Engineering

## Context

MedConnect ships a mobile app, API, and admin portal. Shared conventions, coordinated releases, and a single PR workflow benefit a small startup team.

## Decision

Use a single repository with npm workspaces containing `mobile`, `backend`, and `admin` packages. Root `package.json` orchestrates dev scripts; each package remains independently runnable.

## Consequences

### Positive

- One clone, one issue tracker, unified CI
- Shared documentation and ADRs
- Simple onboarding

### Negative

- Larger `node_modules` footprint
- CI must target changed workspaces (future optimization)

### Neutral

- Can adopt Turborepo or Nx later without changing package layout

## Alternatives considered

1. **Polyrepo** — rejected; higher coordination overhead for early team size.
2. **pnpm workspaces** — viable; deferred to reduce tooling prerequisites (npm only).
