# Infrastructure

Uniscope infrastructure documentation.

> **Note:** As of 2026-06-14, Uniscope has migrated to **cloud-first infrastructure**.
> Local Docker Compose is deprecated. See [Cloud Services](#cloud-services) below.

## Cloud Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Database | Supabase PostgreSQL | Primary data store |
| Cache / Sessions | Upstash Redis | OTP storage, session data, presence |
| OTP Delivery | Twilio Verify API | SMS-based one-time passwords |
| File Storage | Supabase Storage | Verification docs, avatars, media |
| Backend Hosting | Railway | Auto-deploy from GitHub |
| Mobile | Expo + EAS Build | iOS and Android app builds |

## Contents

| Path | Purpose |
| ---- | ------- |
| [docker/](docker/) | **DEPRECATED** — Local Docker Compose (historical reference only) |
| [deployment/](deployment/) | Placeholder for CI/CD and deployment configs |

## Environment Setup

Developers do **not** run local infrastructure. All services are cloud-hosted.

1. Copy `backend/.env.example` → `backend/.env`
2. Fill in credentials from:
   - **Database:** Supabase Dashboard → Settings → Database → Connection string
   - **Redis:** [console.upstash.com](https://console.upstash.com) → Redis → Connect → ioredis
   - **OTP:** [console.twilio.com](https://console.twilio.com) → Verify → Services
   - **Storage:** Supabase Dashboard → Storage

## Environments

| Environment | Branch | Backend URL | Notes |
|-------------|--------|-------------|-------|
| Development | `develop` | localhost:3000 | Uses dev Supabase project |
| Production | `feature/flutter-migration` | Railway production (`uniscope` service) | Auto-deploy on push |

## Infrastructure Ownership

All cloud resources (Supabase, Upstash, Twilio, Railway) are owned and managed by **Kiran Raj**.
Developers consume services via environment variables only — no direct infrastructure access required.

For access to credentials, contact the infrastructure owner.
