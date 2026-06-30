# ADR 0002: PostgreSQL with Prisma ORM

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Engineering

## Context

MedConnect needs relational data (users, universities, reviews, discussions) with strong consistency, migrations, and type-safe access from NestJS.

## Decision

Use PostgreSQL as the primary database and Prisma 7 as the ORM in the `backend` package. Schema lives in `backend/prisma/schema.prisma`. Migrations are managed with Prisma Migrate.

## Consequences

### Positive

- Mature relational model for structured domain data
- Type-safe client generation
- Clear migration workflow

### Negative

- Prisma schema and DB must stay in sync via migrations
- Team must learn Prisma-specific patterns

### Neutral

- Raw SQL available via Prisma `$queryRaw` when justified by future ADR

## Alternatives considered

1. **TypeORM** — rejected; Prisma offers stronger schema-first DX for startups.
2. **MongoDB** — rejected for initial relational domain modeling.
