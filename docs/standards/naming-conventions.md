# Naming conventions

## Repository & branches

| Item | Convention | Example |
| ---- | ---------- | ------- |
| Repo | `medconnect` | — |
| Main branch | `main` | production-ready |
| Integration branch | `develop` | integration |
| Feature branches | `feature/<short-description>` | `feature/user-onboarding` |
| Bug branches | `bugfix/<short-description>` | `bugfix/health-check-404` |
| Hotfix branches | `hotfix/<short-description>` | `hotfix/critical-db-pool` |

## Packages

| Package | npm name | Folder |
| ------- | -------- | ------ |
| Monorepo root | `medconnect` | `/` |
| Mobile | `mobile` | `mobile/` |
| API | `backend` | `backend/` |
| Admin | `admin` | `admin/` |

## TypeScript / JavaScript

| Element | Convention | Example |
| ------- | ---------- | ------- |
| Variables, functions | camelCase | `getUserProfile` |
| Classes, interfaces, types | PascalCase | `UserService`, `CreateUserDto` |
| Constants (global) | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Enums | PascalCase type, PascalCase members | `UserRole.Admin` |
| Files (backend) | kebab-case or dot-suffix | `user.service.ts` |
| Files (React) | PascalCase components | `HomeScreen.tsx` |
| Hooks | `use` prefix | `useAuth` |

## Database (Prisma)

| Element | Convention | Example |
| ------- | ---------- | ------- |
| Model | PascalCase singular | `User` |
| Table (`@@map`) | snake_case plural | `users` |
| Column (`@map`) | snake_case | `created_at` |
| Relation fields | camelCase | `universityReviews` |
| Migration folder | timestamp + snake_case | `20260101_add_users` |

## API (future)

| Element | Convention | Example |
| ------- | ---------- | ------- |
| REST paths | kebab-case plural nouns | `/api/v1/university-reviews` |
| Query params | camelCase | `?pageSize=20` |
| JSON body fields | camelCase | `{ "firstName": "..." }` |

## Environment variables

| Scope | Prefix | Example |
| ----- | ------ | ------- |
| Backend | none (server-only) | `DATABASE_URL` |
| Admin (public) | `NEXT_PUBLIC_` | `NEXT_PUBLIC_API_URL` |
| Mobile (public) | `EXPO_PUBLIC_` | `EXPO_PUBLIC_API_URL` |

Never prefix secrets with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

## Documentation

| Type | Convention | Example |
| ---- | ---------- | ------- |
| ADR file | `NNNN-short-title.md` | `0001-use-postgresql.md` |
| Sprint folder | `sprint-N` | `sprint-0` |
