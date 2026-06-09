# Coding standards

MedConnect engineering standards for the monorepo. Apply consistently across `mobile`, `backend`, and `admin`.

## General

- **TypeScript everywhere** — no `any` without justification and a comment.
- **Explicit over clever** — readable code beats dense abstractions.
- **Small PRs** — one concern per pull request when possible.
- **No secrets in git** — use `.env` and `.env.example` only.

## Formatting & linting

| Package | Tooling |
| ------- | ------- |
| backend | ESLint + Prettier (NestJS defaults) |
| admin | ESLint (Next.js defaults) |
| mobile | TypeScript strict mode; add ESLint in Sprint 1 |

Run format/lint before opening PRs.

## TypeScript

- Enable `strict` mode in all packages.
- Prefer `interface` for object shapes; `type` for unions and utilities.
- Use explicit return types on public APIs and module boundaries.
- Avoid default exports except where framework requires (Next.js pages, Expo entry).

## Backend (NestJS)

- One feature per module under `src/modules/<feature>/`.
- Controllers: HTTP only — delegate to services.
- Services: business logic and orchestration.
- DTOs: class-validator when validation is introduced.
- Use `PrismaService` for data access — no raw SQL without ADR.

### File naming

- `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`

## Mobile (Expo / React Native)

- Functional components with hooks.
- Screens in `src/screens/`, reusable UI in `src/components/`.
- API clients in `src/services/` (future).
- Navigation in `src/navigation/` (future).
- No inline styles for complex layouts — use `StyleSheet` or a design system (future).

## Admin (Next.js)

- App Router under `app/`.
- Server Components by default; `'use client'` only when needed.
- Shared UI in `components/`, utilities in `lib/`.
- Fetch server-side when possible; client hooks in `hooks/`.

## Git & commits

- Conventional commit prefixes: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.
- Scope required: `mobile`, `backend`, `admin`, `docs`, `infra`.

## Testing (introduced incrementally)

| Layer | Target |
| ----- | ------ |
| backend | Jest unit + e2e for modules |
| admin | Component tests (future) |
| mobile | Jest + React Native Testing Library (future) |

## Database & Prisma

- Review generated migration SQL before merging.
- Descriptive migration names: `add_user_email_index`.
- Never edit applied migrations — create a new migration instead.
- Use `prisma migrate dev` in development; `migrate deploy` in CI/production.

## Security (foundation)

- Validate all external input at boundaries (future).
- Parameterized queries via Prisma — no string-concatenated SQL.
- CORS, helmet, and rate limits before public launch (future ADRs).

## Documentation

- Update `docs/` when changing architecture or env vars.
- Add ADRs for significant technical decisions.
