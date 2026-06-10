# MedConnect — System Architecture v1

**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-06-09  
**Owner:** Engineering

---

## 1. Architecture Overview

MedConnect is a mobile-first platform with a monolithic NestJS backend, PostgreSQL persistence, and a Next.js admin portal. The architecture is deliberately simple for the MVP — optimised for team velocity over horizontal scalability — with clear seams to evolve toward microservices or service extraction when warranted by growth.

```mermaid
flowchart TB
    subgraph clients [Client Layer]
        Mobile["Mobile App\n(Expo React Native)"]
        AdminPortal["Admin Portal\n(Next.js)"]
    end

    subgraph cdn [Edge / CDN]
        CDN["CDN\n(Static assets, media)"]
    end

    subgraph api [API Layer]
        Gateway["API Gateway\n(NestJS REST)"]
        WS["WebSocket Gateway\n(NestJS + Socket.IO)"]
    end

    subgraph services [Service Layer — NestJS Modules]
        AuthSvc["Auth Service\n(OTP, JWT)"]
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

    subgraph data [Data Layer]
        PG[("PostgreSQL\n(Primary)")]
        Redis[("Redis\n(Sessions, OTP, Presence)")]
        ObjectStore["Object Storage\n(S3-compatible)\nVerification docs\nProfile photos"]
    end

    subgraph notifications [Notification Layer]
        FCM["Firebase Cloud Messaging\n(Push — Android)"]
        APNS["APNs\n(Push — iOS)"]
        SMS["SMS Provider\n(OTP delivery)"]
    end

    Mobile -->|HTTPS REST| Gateway
    Mobile -->|WSS| WS
    AdminPortal -->|HTTPS REST| Gateway
    Mobile --> CDN
    Gateway --> AuthSvc & UserSvc & UnivSvc & QASvc & ReviewSvc & ChatSvc & VerifSvc & NotifSvc & ModerationSvc & StorageSvc
    WS --> ChatSvc & NotifSvc
    AuthSvc --> Redis
    AuthSvc --> SMS
    ChatSvc --> PG & Redis
    NotifSvc --> FCM & APNS
    UserSvc & UnivSvc & QASvc & ReviewSvc & VerifSvc & ModerationSvc --> PG
    StorageSvc --> ObjectStore
    VerifSvc --> ObjectStore
```

---

## 2. Mobile Application

**Technology:** React Native + Expo (TypeScript)

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

## 4. PostgreSQL

**Version:** PostgreSQL 16  
**ORM:** Prisma 7

### Logical database layout

```
medconnect_db
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
- Connection pooling via PgBouncer in front of PostgreSQL in production

---

## 5. Object Storage

**Provider:** S3-compatible (AWS S3 or Cloudflare R2)

### Buckets

| Bucket | Contents | Access | Retention |
|--------|----------|--------|-----------|
| `medconnect-verification-docs` | Student ID cards, degree certificates | Private — pre-signed URLs only | 7 years (compliance) |
| `medconnect-profile-photos` | User avatars | Public CDN-served | Indefinite |
| `medconnect-chat-media` | Images/files sent in chat | Private — pre-signed | 90 days |

### Upload flow (verification documents)

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant API as Backend API
    participant S3 as Object Storage
    participant Admin as Admin Portal

    App->>API: POST /verification/upload-url (file type, size)
    API->>S3: Generate pre-signed PUT URL (15 min TTL)
    API-->>App: { uploadUrl, documentKey }
    App->>S3: PUT file directly (no API in path)
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

- Provider: AWS SNS or Twilio (ADR required before Sprint 1)
- OTP: 6-digit numeric, 10-minute TTL
- Rate limit: 3 OTP requests per phone per 15 minutes
- Stored in Redis (not PostgreSQL) with TTL

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

## 8. Infrastructure topology (production target)

```mermaid
flowchart TB
    subgraph internet [Internet]
        MobileApp[Mobile App]
        Admins[Admin Browser]
    end

    subgraph edge [Edge]
        CF[Cloudflare\nDNS + WAF + CDN]
    end

    subgraph compute [Compute — single region initially]
        LB[Load Balancer]
        API1[API Instance 1]
        API2[API Instance 2]
        AdminApp[Admin Next.js\nServerless]
    end

    subgraph data [Data]
        PGPrimary[(PostgreSQL Primary)]
        PGReplica[(PostgreSQL Replica\nread-only)]
        RedisCluster[(Redis)]
        S3[(Object Storage)]
    end

    subgraph external [External Services]
        SMS[SMS Provider]
        FCM_APNS[FCM / APNs]
    end

    MobileApp --> CF
    Admins --> CF
    CF --> LB & AdminApp
    LB --> API1 & API2
    API1 & API2 --> PGPrimary & RedisCluster & S3
    PGPrimary --> PGReplica
    API1 & API2 --> SMS & FCM_APNS
```

---

## 9. Non-functional requirements

| Concern | Target | Notes |
|---------|--------|-------|
| API p95 latency | < 300ms | Excluding media upload |
| Availability | 99.5% | MVP; 99.9% post-scale |
| Chat message delivery | < 500ms p95 | WebSocket; real-time feel |
| OTP delivery | < 10 seconds | SMS provider SLA |
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
| Cache / OTP store | Redis | PostgreSQL (wrong tool), Memcached (less feature-rich) |
| Object storage | S3-compatible | Cloudinary (cost at scale), Firebase Storage (lock-in) |
| Push | FCM + APNs via backend | Expo Push (abstraction loss at scale) |
