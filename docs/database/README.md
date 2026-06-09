# Database

## Technology

- **Engine:** PostgreSQL 15+
- **ORM:** Prisma 7
- **Schema location:** `backend/prisma/schema.prisma`
- **CLI config (Prisma 7):** `backend/prisma.config.ts` — `DATABASE_URL` lives here, not in the schema file

## Current state (Sprint 0)

The schema contains only generator and datasource configuration. **No business models** are defined yet.

## Conventions (when models are added)

- Table names: `snake_case` plural (`users`, `university_reviews`)
- Model names in Prisma: `PascalCase` singular (`User`, `UniversityReview`)
- Primary keys: `id` with `cuid()` or `uuid()` per ADR
- Timestamps: `createdAt`, `updatedAt` on all mutable entities
- Soft deletes: `deletedAt` where audit trail matters

## Migrations

```bash
# Development
npm run prisma:migrate:dev --workspace=backend

# Production deploy
npm run prisma:migrate:deploy --workspace=backend
```

Follow [migration best practices](../standards/coding-standards.md#database--prisma).

## Local database

See [local setup](../development/local-setup.md) and `infrastructure/docker/docker-compose.yml`.
