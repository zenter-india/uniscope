# MedConnect — Sprint 1 Plan

**Sprint:** 1  
**Duration:** 2 weeks  
**Status:** Planning  
**Goal:** Authenticated users can log in via OTP on mobile, receive a JWT, and see the real university list from the database.

---

## Sprint Goal (in one sentence)

> A new user can open the app, enter their phone number, verify via OTP, select their role, and land on the Home screen — all backed by real API and database.

---

## Scope Boundaries

### In Sprint 1
- Prisma schema for all 11 entities (no feature endpoints yet; just the foundation)
- Backend auth module (OTP request, OTP verify, JWT issue, refresh)
- Mobile auth store (Zustand) wired to real backend
- University read API — list + detail (needed to smoke-test the flow end-to-end)
- Push token registration endpoint (required for later sprints; low cost now)
- Admin portal auth (Next.js session login — email/password only; no OTP)

### Explicitly out of Sprint 1
- Q&A (questions, answers, votes)
- Reviews
- Chat / messaging
- Verification submission or review
- Content moderation / reports
- Notifications (push send)
- University search / filters

---

## Architecture Context

```
Mobile (Expo)
  │
  │  HTTPS (REST)
  ▼
NestJS API (backend/)
  │  Prisma 7
  ▼
PostgreSQL (Docker Compose)
  │
  ├── Redis (OTP store, TTL 10 min)
  └── S3 / MinIO (future; not Sprint 1)
```

### Auth flow (per security-model-v1.md)

```
1. POST /auth/otp/request    { phone }
      → backend hashes phone, stores otp:<hash> in Redis (TTL 10m)
      → SMS sent (mocked via console.log in Sprint 1)
      → returns { requestId }

2. POST /auth/otp/verify     { requestId, otp }
      → backend validates OTP from Redis
      → if new user: creates User record (role = PROSPECTIVE)
      → if existing user: fetches User record
      → returns { accessToken, refreshToken, isNewUser }

3. POST /auth/token/refresh  { refreshToken }
      → validates refreshToken hash against DB
      → issues new accessToken (15-min TTL)
      → rotates refreshToken (7-day TTL)
      → returns { accessToken, refreshToken }

4. POST /auth/logout         (requires accessToken)
      → clears refreshTokenHash in DB
      → returns 204
```

### JWT payload

```json
{
  "sub": "<userId>",
  "role": "PROSPECTIVE",
  "iat": 1000000,
  "exp": 1000900
}
```

---

## Workstreams

### Track A — Database (Days 1–3)

| Task | Description |
|------|-------------|
| A1 | Write Prisma schema for all 11 entities per `domain-model-v1.md` |
| A2 | Run `prisma migrate dev --name init` to create initial migration |
| A3 | Write seed script with 10 universities + 1 admin user |
| A4 | Verify schema with `prisma studio` |

**Entities to model:** `User`, `UserProfile`, `University`, `VerificationRequest`, `Question`, `Answer`, `AnswerVote`, `Review`, `ChatRoom`, `Message`, `Report`

**Supporting models:** `PushToken` (for push registration endpoint)

---

### Track B — Backend Auth (Days 2–6)

| Task | Description |
|------|-------------|
| B1 | Install: `ioredis`, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcryptjs`, `@types/bcryptjs` |
| B2 | `RedisModule` — shared ioredis client, inject via DI |
| B3 | `OtpService` — generate 6-digit OTP, store in Redis with `otp:<phoneHash>:<otp>` key pattern, TTL 10 min |
| B4 | `AuthModule` — `OtpController`, `JwtStrategy`, `RefreshTokenGuard` |
| B5 | `POST /auth/otp/request` — rate-limited (5 req/phone/hour via Redis counter) |
| B6 | `POST /auth/otp/verify` — creates user if new, issues JWT pair |
| B7 | `POST /auth/token/refresh` — rotates refresh token |
| B8 | `POST /auth/logout` — invalidates refresh token |
| B9 | `JwtAuthGuard` + `RolesGuard` for protecting routes |
| B10 | `POST /users/me/push-token` — register Expo push token |

---

### Track C — Backend University API (Days 5–7)

| Task | Description |
|------|-------------|
| C1 | `UniversityModule` with `UniversityService` + `UniversityController` |
| C2 | `GET /universities` — paginated list (cursor-based), filters: state, type, search |
| C3 | `GET /universities/:slug` — university detail |
| C4 | DTOs with `class-validator`, response serialisation with `class-transformer` |
| C5 | No auth required for read endpoints (public) |

---

### Track D — Mobile Auth (Days 4–8)

| Task | Description |
|------|-------------|
| D1 | Install: `zustand`, `@react-native-async-storage/async-storage` |
| D2 | `useAuthStore` (Zustand) — `accessToken`, `refreshToken`, `user`, `isAuthenticated` |
| D3 | `api/client.ts` — Axios instance with base URL, interceptors for JWT header + 401 refresh |
| D4 | `api/auth.ts` — typed functions: `requestOtp`, `verifyOtp`, `refreshToken`, `logout` |
| D5 | Wire `LoginScreen` → `requestOtp` call + navigate to OTP screen |
| D6 | Wire `OtpScreen` → `verifyOtp` call, store tokens, navigate by `isNewUser` flag |
| D7 | Wire `RoleSelectionScreen` → `PATCH /users/me` to persist chosen role |
| D8 | Wire `ProfileSetupScreen` → `PATCH /users/me/profile` |
| D9 | `RootNavigator` auth gate — read `isAuthenticated` from store, not hardcoded flag |
| D10 | Token refresh on app foreground (`AppState` listener) |

---

### Track E — Admin Portal Auth (Days 6–9)

| Task | Description |
|------|-------------|
| E1 | Install NextAuth.js (Credentials provider — email + bcrypt password) |
| E2 | Admin login page (`/login`) |
| E3 | Middleware protecting all `/dashboard/*` routes |
| E4 | Placeholder dashboard at `/dashboard` (just a skeleton) |
| E5 | Environment: `NEXTAUTH_SECRET`, `ADMIN_API_URL` |

---

## Dependency Graph

```
A1 → A2 → A3
          ↓
     B1 → B2 → B3 → B4–B9
                          ↓
                     C1–C5 (parallel with B)
                          ↓
                     D1–D10 (depends on B API being available)
                          ↓
                     E1–E5 (parallel with D)
```

---

## Definition of Done

A story is DONE when:
- [ ] Code reviewed and merged to `develop`
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] Unit tests for all service methods (Jest)
- [ ] Manual smoke test documented (or automated e2e)
- [ ] Environment variables documented in `.env.example`
- [ ] No `console.log` left in production code paths (stubs OK in Sprint 1 for SMS)

---

## Environment Variables Added This Sprint

### backend/.env.example additions

```
# Auth
JWT_ACCESS_SECRET=change-me-access-secret
JWT_REFRESH_SECRET=change-me-refresh-secret
JWT_ACCESS_TTL=900          # 15 minutes in seconds
JWT_REFRESH_TTL=604800      # 7 days in seconds

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# OTP (SMS provider — mocked in Sprint 1)
OTP_SMS_PROVIDER=mock       # mock | twilio | aws-sns
OTP_RATE_LIMIT=5            # max OTP requests per phone per hour
```

### admin/.env.example additions

```
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=change-me-nextauth-secret
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### mobile additions

```
EXPO_PUBLIC_API_URL=http://localhost:3000
```

---

## Infrastructure Changes

- Add `redis` service to `infrastructure/docker-compose.yml`
- Update `infrastructure/README.md` with Redis connection instructions

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| SMS provider decision (Twilio vs SNS) | Low | Medium | Mock SMS in Sprint 1; ADR deferred to Sprint 2 |
| Expo Push Token format change | Low | Low | Abstract behind `PushTokenService` |
| bcrypt phone hash timing attack | Low | High | Use constant-time compare; documented in security model |
| Redis not running locally | Medium | High | `docker-compose up redis` in README; health check endpoint |
| Disk space on dev machines | Medium | Medium | `.gitignore` all generated files; `prisma generate` in `postinstall` |

---

## Sprint Ceremonies

| Event | When |
|-------|------|
| Sprint Planning | Day 1 |
| Daily standup | Async in Slack |
| Mid-sprint review | Day 7 |
| Demo | Day 14 |
| Retrospective | Day 14 (post-demo) |
