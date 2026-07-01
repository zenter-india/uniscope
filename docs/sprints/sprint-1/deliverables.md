# Uniscope — Sprint 1 Deliverables

**Sprint:** 1  
**Status:** Not started

---

## End-State: What the app can do after Sprint 1

1. **New user opens the app** → lands on Welcome screen
2. **Enters phone number** → real OTP is "sent" (console-mocked in Sprint 1; real SMS in Sprint 2)
3. **Enters OTP** → verified, JWT pair issued and stored on device
4. **Selects role** (Prospective / Student / Alumni) → persisted to database
5. **Sets display name** → profile created
6. **Lands on Home screen** — auth-gated, real session
7. **University list** → real data from PostgreSQL (10 seeded institutions)
8. **Admin logs in** at `localhost:3001` → sees dashboard skeleton
9. **Token refresh** happens silently in background on app foreground

---

## Artifacts Shipped

### Backend

```
backend/
├── prisma/
│   ├── schema.prisma          ← 11 entities + PushToken; all indexes
│   ├── migrations/
│   │   └── 0001_init/         ← Initial migration SQL
│   └── seed.ts                ← 10 universities + admin user
│
└── src/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts  ← POST /auth/otp/request, /verify, /token/refresh, /logout
    │   ├── auth.service.ts
    │   ├── otp.service.ts      ← Redis OTP store
    │   ├── jwt.strategy.ts
    │   ├── jwt-auth.guard.ts
    │   └── roles.guard.ts
    │
    ├── users/
    │   ├── users.module.ts
    │   ├── users.controller.ts ← PATCH /users/me, POST /users/me/push-token
    │   └── users.service.ts
    │
    ├── universities/
    │   ├── universities.module.ts
    │   ├── universities.controller.ts ← GET /universities, GET /universities/:slug
    │   └── universities.service.ts
    │
    └── redis/
        └── redis.module.ts
```

### Mobile

```
mobile/src/
├── api/
│   ├── client.ts              ← Axios + JWT interceptors + silent refresh
│   └── auth.ts                ← requestOtp, verifyOtp, refreshToken, logout
│
├── store/
│   └── useAuthStore.ts        ← Zustand store: tokens, user, isAuthenticated
│
└── screens/
    └── auth/
        ├── LoginScreen.tsx     ← wired to real OTP request
        ├── OtpScreen.tsx       ← wired to real verify
        ├── RoleSelectionScreen.tsx ← PATCH /users/me
        └── ProfileSetupScreen.tsx  ← PATCH /users/me
```

### Admin

```
admin/
├── app/
│   ├── login/
│   │   └── page.tsx           ← Email + password form
│   ├── dashboard/
│   │   └── page.tsx           ← Skeleton with sidebar nav
│   └── api/auth/[...nextauth]/
│       └── route.ts           ← NextAuth Credentials provider
│
└── middleware.ts               ← Protect /dashboard/*
```

### Infrastructure

```
infrastructure/
└── docker-compose.yml         ← Adds redis:7-alpine service
```

---

## API Contract (Sprint 1 endpoints)

### Auth

```
POST /auth/otp/request
  Body:    { "phone": "+919876543210" }
  Returns: { "requestId": "req_xxxxxx" }
  Errors:  429 Too Many Requests (rate limit)

POST /auth/otp/verify
  Body:    { "requestId": "req_xxxxxx", "otp": "123456" }
  Returns: { "accessToken": "...", "refreshToken": "...", "isNewUser": true }
  Errors:  401 Invalid OTP | 401 Expired OTP

POST /auth/token/refresh
  Body:    { "refreshToken": "..." }
  Returns: { "accessToken": "...", "refreshToken": "..." }
  Errors:  401 Invalid Token

POST /auth/logout
  Auth:    Bearer <accessToken>
  Returns: 204 No Content
```

### Users

```
PATCH /users/me
  Auth:    Bearer <accessToken>
  Body:    { "role"?: "STUDENT_UNVERIFIED" | "ALUMNI_UNVERIFIED", "displayName"?: "..." }
  Returns: { "id": "...", "role": "...", "displayName": "..." }

POST /users/me/push-token
  Auth:    Bearer <accessToken>
  Body:    { "token": "ExponentPushToken[xxx]", "platform": "ios" | "android" }
  Returns: 201 Created
```

### Universities

```
GET /universities
  Query:   ?cursor=&state=Karnataka&type=GOVERNMENT&search=medical&limit=20
  Auth:    None (public)
  Returns: { "data": [...], "nextCursor": "..." | null }

GET /universities/:slug
  Auth:    None (public)
  Returns: { University object }
```

---

## Testing Plan

| Layer | Framework | Coverage target |
|-------|-----------|----------------|
| Backend services | Jest unit | Auth + OTP logic: 90%+ |
| Backend controllers | Jest + supertest | All happy paths + error cases |
| Mobile store | Jest | useAuthStore actions |
| Mobile API client | Jest + MSW | Interceptor + refresh flow |
| E2E | Manual smoke test checklist | Full OTP flow on iOS simulator |

---

## Manual Smoke Test Checklist

Run these before marking Sprint 1 done:

- [ ] `docker-compose up` starts postgres + redis without errors
- [ ] `npm run prisma:migrate:dev --workspace=backend` runs clean
- [ ] `npm run prisma:seed --workspace=backend` creates 10 universities + admin user
- [ ] `npm run dev:backend` starts on port 3000, `/health` returns 200
- [ ] `POST /auth/otp/request` logs OTP to console (mock)
- [ ] `POST /auth/otp/verify` with correct OTP returns JWT pair
- [ ] `POST /auth/otp/verify` with wrong OTP returns 401
- [ ] `GET /universities` returns 10 records (seeded)
- [ ] `npm run dev:mobile` starts Expo; Welcome screen renders
- [ ] OTP login flow completes; navigates to RoleSelection for new users
- [ ] App reopened: auth gate reads stored tokens, navigates to Home (no re-login)
- [ ] `npm run dev:admin` starts on port 3001; `/login` renders
- [ ] Admin login with seeded credentials → `/dashboard`
- [ ] Invalid admin credentials → stays on `/login` with error

---

## Definition of Done (Sprint level)

- [ ] All smoke test checklist items pass
- [ ] `npm run lint --workspaces` exits 0
- [ ] `npm run test --workspaces` exits 0
- [ ] No `any` types added to navigation or auth code
- [ ] All new env vars documented in `.env.example`
- [ ] PR merged to `develop` with review
- [ ] Sprint retrospective doc updated
