# Uniscope — Sprint 1 Backlog

**Sprint:** 1  
**Total Points:** 34  

> Sizing: 1 = trivial (< 1 hr) · 2 = small (2–3 hr) · 3 = medium (half day) · 5 = large (full day) · 8 = very large (1.5–2 days)

---

## Track A — Database

| ID | Title | Points | Depends On | Assignee |
|----|-------|--------|-----------|---------|
| A1 | Write Prisma schema — all 11 entities + PushToken model | 5 | — | |
| A2 | Run initial migration (`prisma migrate dev --name init`) | 1 | A1 | |
| A3 | Write seed script — 10 universities + 1 admin user | 3 | A2 | |
| A4 | Add `pg_trgm` extension to migration for trigram indexes | 1 | A2 | |

**Acceptance criteria A1:**
- All entities from `domain-model-v1.md` are modelled exactly
- cuid2 IDs (`@default(cuid())`)
- Soft-delete `deletedAt` on all mutable entities
- All documented indexes are present
- `prisma validate` passes with zero errors

**Acceptance criteria A3:**
- `npm run prisma:seed --workspace=backend` runs without error
- 10 universities cover at least 4 states and all 4 type variants
- Admin user created with role `SUPER_ADMIN` and a known bcrypt-hashed password
- Seed is idempotent (runs multiple times without duplicates — use `upsert`)

---

## Track B — Backend Auth

| ID | Title | Points | Depends On | Assignee |
|----|-------|--------|-----------|---------|
| B1 | Install auth dependencies | 1 | — | |
| B2 | `RedisModule` — ioredis client, injectable | 2 | B1 | |
| B3 | `OtpService` — generate, store, verify OTP | 3 | B2 | |
| B4 | `JwtService` wrapper — issue access + refresh tokens | 3 | A2 | |
| B5 | `POST /auth/otp/request` — rate-limited OTP send | 3 | B3 | |
| B6 | `POST /auth/otp/verify` — verify OTP, create/fetch user, issue tokens | 5 | B4, B5 | |
| B7 | `POST /auth/token/refresh` — token rotation | 3 | B4 | |
| B8 | `POST /auth/logout` — clear refresh token | 1 | B6 | |
| B9 | `JwtAuthGuard` + `RolesGuard` decorators | 2 | B4 | |
| B10 | `PATCH /users/me` — update role + profile fields | 3 | B9 | |
| B11 | `POST /users/me/push-token` — register Expo push token | 2 | B9 | |

**Acceptance criteria B6:**
- New user: `User` record created with `role = PROSPECTIVE`, `verificationStatus = NONE`
- Existing user: record fetched, tokens refreshed
- OTP deleted from Redis after successful verify (one-time use)
- Invalid OTP returns 401 with generic error (no oracle attack)
- Expired OTP (> 10 min) returns 401
- 5+ failed attempts on same phone within 1 hour: 429

**Acceptance criteria B9:**
- `@UseGuards(JwtAuthGuard)` rejects missing/invalid token with 401
- `@Roles(Role.ADMIN)` with `RolesGuard` rejects wrong role with 403
- Guards work correctly in integration test suite

---

## Track C — University Read API

| ID | Title | Points | Depends On | Assignee |
|----|-------|--------|-----------|---------|
| C1 | `UniversityModule` scaffold | 1 | A2 | |
| C2 | `GET /universities` — list (cursor pagination, state/type filter) | 3 | C1 | |
| C3 | `GET /universities/:slug` — detail | 2 | C1 | |
| C4 | Response DTOs + serialisation | 2 | C2, C3 | |

**Acceptance criteria C2:**
- Returns max 20 per page by default
- Supports `?cursor=`, `?state=`, `?type=`, `?search=` query params
- Response shape: `{ data: University[], nextCursor: string | null }`
- No auth required; rate-limited to 100 req/IP/min (via global guard)

---

## Track D — Mobile Auth

| ID | Title | Points | Depends On | Assignee |
|----|-------|--------|-----------|---------|
| D1 | Install Zustand + AsyncStorage | 1 | — | |
| D2 | `useAuthStore` — tokens, user object, actions | 3 | D1 | |
| D3 | Axios client with JWT interceptor + silent refresh | 3 | D2 | |
| D4 | `api/auth.ts` — typed API functions | 2 | D3 | |
| D5 | Wire `LoginScreen` → OTP request | 2 | D4, B5 | |
| D6 | Wire `OtpScreen` → verify + store tokens | 3 | D5, B6 | |
| D7 | Wire `RoleSelectionScreen` → PATCH /users/me | 2 | D6, B10 | |
| D8 | Wire `ProfileSetupScreen` → displayName update | 2 | D7 | |
| D9 | `RootNavigator` — real auth gate from store | 1 | D2 | |
| D10 | App foreground token refresh (`AppState`) | 2 | D3 | |

**Acceptance criteria D6:**
- On success: tokens stored in AsyncStorage + Zustand, navigates to RoleSelection if `isNewUser`, Home if existing
- On invalid OTP: error state shown on OTP screen, no navigation
- On network error: offline error shown
- Tokens never logged to console

**Acceptance criteria D3:**
- Every authenticated request includes `Authorization: Bearer <token>` header
- On 401 response: silent refresh attempted once
- On refresh failure: store cleared, user navigated to Welcome screen
- On network timeout (10s): request fails gracefully

---

## Track E — Admin Auth

| ID | Title | Points | Depends On | Assignee |
|----|-------|--------|-----------|---------|
| E1 | Install NextAuth.js | 1 | — | |
| E2 | Credentials provider — backend validates email + password | 2 | B9 | |
| E3 | Login page `/login` with email + password form | 2 | E1 | |
| E4 | Next.js middleware protecting `/dashboard/*` | 1 | E3 | |
| E5 | Placeholder `/dashboard` with nav sidebar skeleton | 3 | E4 | |

**Acceptance criteria E5:**
- Login with seeded admin credentials → `/dashboard`
- Unauthenticated request to `/dashboard` → redirect `/login`
- Sidebar shows: Dashboard, Verification Queue, Moderation, Universities, Users (all placeholder)

---

## Bugs / Tech Debt

| ID | Title | Points | Notes |
|----|-------|--------|-------|
| TD1 | Add `EXPO_PUBLIC_API_URL` to mobile `.env.example` | 1 | |
| TD2 | Add Redis to `docker-compose.yml` | 1 | |
| TD3 | Add `prisma generate` to `backend` `postinstall` script | 1 | |
| TD4 | Fix `RootNavigator` hardcoded `isAuthenticated = false` | — | Resolved by D9 |

---

## Velocity Target

| Track | Points |
|-------|--------|
| A — Database | 10 |
| B — Backend Auth | 22 |
| C — University API | 8 |
| D — Mobile Auth | 20 |
| E — Admin Auth | 9 |
| Tech Debt | 3 |
| **Total** | **72** |

> Split across 2 engineers over 2 weeks ≈ 18 points/engineer/week. Adjust scope if needed — Cut E (Admin Auth) first; it has no mobile dependency.
