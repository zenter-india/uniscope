# Uniscope — System Architecture v1

**Version:** 1.1  
**Status:** Active  
**Date:** 2026-06-14  
**Owner:** Engineering

---

## 1. Architecture Overview

Uniscope is a mobile-first platform with a monolithic NestJS backend, Supabase PostgreSQL persistence, and a Next.js admin portal. The architecture is deliberately simple for the MVP — optimised for team velocity over horizontal scalability — with clear seams to evolve toward microservices or service extraction when warranted by growth.

All infrastructure is **cloud-first**: no local services are required for development. See [docs/infrastructure/cloud-services.md](../infrastructure/cloud-services.md) for details.

```mermaid
flowchart TB
    subgraph clients [Client Layer]
        Mobile["Mobile App\n(Expo React Native)"]
        AdminPortal["Admin Portal\n(Next.js)"]
    end

    subgraph hosting [Hosting]
        Railway["Railway\n(Backend API)"]
        EAS["Expo EAS Build\n(iOS / Android)"]
    end

    subgraph api [API Layer]
        Gateway["API Gateway\n(NestJS REST)"]
        WS["WebSocket Gateway\n(NestJS + Socket.IO)"]
    end

    subgraph services [Service Layer — NestJS Modules]
        AuthSvc["Auth Service\n(Twilio OTP, JWT)"]
        UserSvc["User Service"]
        UnivSvc["University Service"]
        QASvc["Q&A Service"]
        ReviewSvc["Review Service"]
        ChatSvc["Chat Service"]
        VerifSvc["Verification Service"]
        NotifSvc["Notification Service"]
        ModerationSvc["Moderation Service"]
        StorageSvc["Storage Service"]
    end

    subgraph cloud [Cloud Infrastructure]
        Supabase[("Supabase PostgreSQL\n(Primary DB)")]
        SupabaseStorage["Supabase Storage\n(Verification docs\nAvatars\nMedia)"]
        Upstash[("Upstash Redis\n(Sessions, OTP, Presence)")]
    end

    subgraph external [External Services]
        Twilio["Twilio Verify\n(SMS OTP)"]
        FCM["Firebase Cloud Messaging\n(Push — Android)"]
        APNS["APNs\n(Push — iOS)"]
    end

    Mobile -->|HTTPS REST| Railway
    Mobile -->|WSS| Railway
    AdminPortal -->|HTTPS REST| Railway
    Railway --> Gateway & WS
    Gateway --> AuthSvc & UserSvc & UnivSvc & QASvc & ReviewSvc & ChatSvc & VerifSvc & NotifSvc & ModerationSvc & StorageSvc
    WS --> ChatSvc & NotifSvc
    AuthSvc --> Upstash
    AuthSvc --> Twilio
    ChatSvc --> Supabase & Upstash
    NotifSvc --> FCM & APNS
    UserSvc & UnivSvc & QASvc & ReviewSvc & VerifSvc & ModerationSvc --> Supabase
    StorageSvc --> SupabaseStorage
    VerifSvc --> SupabaseStorage
```

---

## 2. Mobile Application

**Technology:** React Native + Expo (TypeScript)  
**Distribution:** Expo EAS Build → App Store / Play Store

### Responsibilities
- Student and mentor-facing UI
- OTP authentication flow
- University discovery and search
- Q&A browsing and submission
- Review submission
- Real-time 1:1 chat (WebSocket)
- Push notification handling
- Verification document upload

### Key design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Navigation | React Navigation (Stack + Bottom Tab) | Industry standard for Expo |
| State management | Zustand | Lightweight; no Redux boilerplate for MVP |
| API client | Axios with interceptors | Token refresh handling, error normalisation |
| Real-time | Socket.IO client | Matches backend gateway |
| Media upload | Direct-to-storage pre-signed URLs | Avoids routing large payloads through API |
| Offline | Optimistic UI for Q&A only | Chat requires connectivity |

### Module structure

```
mobile/src/
├── navigation/         # Stack, tab, and auth navigators
├── screens/
│   ├── auth/           # OTP request, OTP verify
│   ├── onboarding/     # Role selection, profile setup
│   ├── discovery/      # University list, university detail
│   ├── qa/             # Question list, question detail, ask question
│   ├── reviews/        # Review list, write review
│   ├── chat/           # Conversation list, chat room
│   ├── verification/   # Document upload, status
│   └── admin/          # (Admin app — separate entry point)
├── components/         # Shared UI: Avatar, Badge, Card, Input
├── services/           # API client, socket client, storage client
├── hooks/              # useAuth, useChat, useNotifications
├── stores/             # Zustand slices
├── types/              # Shared TypeScript types
└── utils/              # Formatters, validators, constants
```

---

## 3. Backend API

**Technology:** NestJS (TypeScript), strict mode  
**Hosting:** Railway (auto-deploy from GitHub)

### REST API conventions

- Base path: `/api/v1/`
- Authentication: Bearer JWT in `Authorization` header
- Versioning: URL path (`/v1/`, `/v2/`)
- Pagination: cursor-based for feeds; offset for admin lists
- Error format: `{ statusCode, error, message, details? }`

### WebSocket gateway

- Namespace: `/chat`
- Authentication: JWT passed as query param on connect (`?token=...`)
- Events: `message:send`, `message:received`, `message:read`, `presence:update`, `typing:start`, `typing:stop`

### NestJS module map

```mermaid
graph LR
    AppModule --> AuthModule
    AppModule --> UsersModule
    AppModule --> UniversitiesModule
    AppModule --> QAModule
    AppModule --> ReviewsModule
    AppModule --> ChatModule
    AppModule --> VerificationModule
    AppModule --> NotificationsModule
    AppModule --> ModerationModule
    AppModule --> StorageModule
    AppModule --> HealthModule

    AuthModule --> PrismaModule
    AuthModule --> RedisModule
    UsersModule --> PrismaModule
    UniversitiesModule --> PrismaModule
    QAModule --> PrismaModule & NotificationsModule
    ReviewsModule --> PrismaModule
    ChatModule --> PrismaModule & RedisModule & NotificationsModule
    VerificationModule --> PrismaModule & StorageModule & NotificationsModule
    ModerationModule --> PrismaModule & NotificationsModule
```

### Horizontal scaling path (post-MVP)

When concurrent chat and notifications load requires it:
1. Extract `ChatModule` to a dedicated service (Socket.IO + Redis adapter for sticky sessions)
2. Extract `NotificationsModule` to an async worker (queue-based — Vercel Queues or BullMQ)
3. Add read replicas to PostgreSQL; route read-heavy Q&A and review queries accordingly

---

## 4. Database: Supabase PostgreSQL

**Provider:** Supabase  
**Version:** PostgreSQL 16  
**ORM:** Prisma 7  
**Environments:** uniscope-dev, uniscope-qa, uniscope-prod

### Connection configuration

- `DATABASE_URL` — Supabase connection pooler (port 6543, pgBouncer) for runtime queries
- `DIRECT_URL` — Direct connection (port 5432) for Prisma migrations

### Logical database layout

```
uniscope_db
├── users                    # Core identity
├── user_profiles            # Role-specific extended profile
├── verification_requests    # ID/credential uploads + status
├── universities             # University master data
├── questions                # Q&A questions
├── answers                  # Q&A answers
├── answer_votes             # Upvotes on answers
├── reviews                  # University reviews
├── review_votes             # Helpful votes on reviews
├── chat_rooms               # 1:1 conversation metadata
├── chat_room_members        # Room membership (2 members/room for MVP)
├── messages                 # Chat messages
├── reports                  # User-submitted reports
├── moderation_actions       # Admin action audit log
├── notifications            # Notification records
└── push_tokens              # Device push tokens per user
```

### Scaling considerations

- All timestamp columns indexed for range queries
- Full-text search via PostgreSQL `tsvector` on questions, answers, reviews, university name/location
- `pg_trgm` extension for similarity search (university autocomplete)
- Partial indexes on `is_deleted = false` for soft-delete patterns
- Connection pooling via Supabase's built-in pgBouncer

---

## 5. Object Storage: Supabase Storage

**Provider:** Supabase Storage

### Buckets

| Bucket | Contents | Access | Retention |
|--------|----------|--------|-----------|
| `verification-docs` | Student ID cards, degree certificates | Private — pre-signed URLs only | 7 years (compliance) |
| `avatars` | User profile photos | Public CDN-served | Indefinite |
| `university-images` | University logos and photos | Public CDN-served | Indefinite |
| `message-media` | Images/files sent in chat | Private — pre-signed | 90 days |

### Upload flow (verification documents)

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant API as Backend API
    participant Storage as Supabase Storage
    participant Admin as Admin Portal

    App->>API: POST /verification/upload-url (file type, size)
    API->>Storage: Generate pre-signed PUT URL (15 min TTL)
    API-->>App: { uploadUrl, documentKey }
    App->>Storage: PUT file directly (no API in path)
    App->>API: POST /verification/submit { documentKey, type }
    API->>API: Record VerificationRequest in DB
    API-->>App: { status: PENDING }
    Admin->>API: GET /admin/verification/queue
    Admin->>API: PATCH /admin/verification/:id { action: APPROVE | REJECT }
    API->>API: Update user verified status
    API-->>App: Push notification — result
```

---

## 6. Notifications

### Push notifications

**Providers:** Firebase Cloud Messaging (Android) + Apple Push Notification service (iOS)

| Trigger | Recipient | Channel |
|---------|-----------|---------|
| Answer posted on user's question | Question author | Push + in-app |
| Answer upvoted | Answer author | Push + in-app |
| Chat message received (app backgrounded) | Recipient | Push |
| Verification approved/rejected | Applicant | Push + in-app |
| Report actioned | Reporter | In-app only |
| Admin: new verification in queue | Admin | Email (future) |

### Notification architecture

```mermaid
flowchart LR
    Event[Domain Event\ne.g. Answer created]
    NotifSvc[Notification Service]
    DB[(notifications table)]
    FCM[FCM]
    APNS[APNs]
    Device[Mobile Device]

    Event --> NotifSvc
    NotifSvc --> DB
    NotifSvc --> FCM & APNS
    FCM & APNS --> Device
```

### OTP (SMS)

- **Provider:** Twilio Verify API v2
- **Pattern:** Provider interface (`OtpProvider`) with `twilio` and `mock` implementations
- OTP: 6-digit numeric, 10-minute TTL
- Rate limit: 5 OTP requests per phone per hour
- `OTP_PROVIDER_TYPE=twilio` in production; `mock` for local development (stores in Redis)

---

## 7. Admin Portal

**Technology:** Next.js App Router (TypeScript)

### Responsibilities
- Verification request queue (review, approve, reject documents)
- User management (view, search, suspend, ban)
- Content moderation queue (review reports, action content)
- University data management (create, edit, deactivate)
- Platform metrics dashboard (future)

### Access control
- Admin portal not distributed via app stores — internal URL
- Separate JWT audience (`aud: admin`) enforced by backend
- Role-based: `ADMIN`, `SUPER_ADMIN`, `MODERATOR`
- All admin actions written to `moderation_actions` audit log

### Admin module layout

```
admin/app/
├── (auth)/
│   └── login/              # Admin OTP login
├── (dashboard)/
│   ├── layout.tsx           # Sidebar nav
│   ├── page.tsx             # Metrics overview
│   ├── verification/        # Verification queue
│   ├── users/               # User management
│   ├── moderation/          # Report queue
│   └── universities/        # University CRUD
```

---

## 8. Infrastructure topology (production)

```mermaid
flowchart TB
    subgraph internet [Internet]
        MobileApp[Mobile App\nExpo / EAS Build]
        Admins[Admin Browser]
    end

    subgraph hosting [Hosting — Railway]
        API[NestJS API\nRailway Service]
        AdminApp[Admin Next.js\nRailway Service]
    end

    subgraph supabase [Supabase]
        PG[(PostgreSQL\nuniscope-prod)]
        SupaStorage[Supabase Storage\nverification-docs, avatars\nuniversity-images, message-media]
    end

    subgraph upstash [Upstash]
        Redis[(Redis\nTLS / serverless)]
    end

    subgraph external [External Services]
        Twilio[Twilio Verify\nSMS OTP]
        FCM_APNS[FCM / APNs\nPush notifications]
    end

    MobileApp -->|HTTPS REST + WSS| API
    Admins --> AdminApp
    AdminApp -->|HTTPS REST| API
    API --> PG & SupaStorage & Redis
    API --> Twilio & FCM_APNS
```

---

## 9. Non-functional requirements

| Concern | Target | Notes |
|---------|--------|-------|
| API p95 latency | < 300ms | Excluding media upload |
| Availability | 99.5% | MVP; 99.9% post-scale |
| Chat message delivery | < 500ms p95 | WebSocket; real-time feel |
| OTP delivery | < 10 seconds | Twilio Verify SLA |
| Verification review SLA | < 48 hours | Manual admin process |
| Max concurrent WebSocket connections | 10,000 | Single instance; Redis adapter for scale-out |
| File upload size limit | 10 MB | Verification documents |

---

## 10. Technology decision log

| Decision | Choice | Alternatives rejected |
|----------|--------|----------------------|
| Backend framework | NestJS | Express (less structure), Fastify (smaller ecosystem) |
| ORM | Prisma 7 | TypeORM (weaker DX), Drizzle (too new) |
| Real-time | Socket.IO via NestJS Gateway | WebSockets raw (less feature-rich), SSE (no bidirectional) |
| State management (mobile) | Zustand | Redux Toolkit (overhead), Jotai (less familiar) |
| Cache / OTP store | Upstash Redis | Local Redis (not cloud-native), PostgreSQL (wrong tool) |
| Object storage | Supabase Storage | AWS S3 (extra account), Cloudinary (cost at scale) |
| Push | FCM + APNs via backend | Expo Push (abstraction loss at scale) |
| OTP provider | Twilio Verify | AWS SNS (higher latency in IN region), Firebase Phone Auth (mobile SDK lock-in) |
| Backend hosting | ~~Render~~ → **Railway** (superseded, see below) | Railway (pricing), Fly.io (ops complexity for MVP) |
| Database | Supabase PostgreSQL | AWS RDS (ops overhead), PlanetScale (MySQL only) |

> **Backend hosting superseded:** the project actually deployed on Render
> only briefly (or never fully) before moving to Railway — production has
> been Railway (project "Uniscope Mobile", service `uniscope`) for some
> time now. The stale `render.yaml` service descriptor this left behind in
> the repo root was deleted; see `ai/SECURITY.md` § S-1.
