# MedConnect — Cloud Services

## Database: Supabase PostgreSQL

- **Environments:** medconnect-dev, medconnect-qa, medconnect-prod
- **Connection:** Prisma via `DATABASE_URL` (pooler, port 6543) + `DIRECT_URL` (migrations, port 5432)
- **Dashboard:** [app.supabase.com](https://app.supabase.com)
- The pooler URL (`?pgbouncer=true`) must be used for runtime — direct URL only for migrations

## Cache / Sessions: Upstash Redis

- **TLS connection** via `REDIS_URL` (`rediss://` scheme)
- Serverless — no local setup required
- Used for: OTP storage, rate limiting, session data, presence tracking
- **Dashboard:** [console.upstash.com](https://console.upstash.com)

## OTP: Twilio Verify

- **Service:** Twilio Verify API v2
- **Provider pattern:** `OTP_PROVIDER_TYPE=twilio` (production) | `mock` (local dev)
- Mock provider stores OTP in Redis and logs to console — no Twilio credentials needed locally
- **Dashboard:** [console.twilio.com](https://console.twilio.com) → Verify → Services

## Storage: Supabase Storage

- **Buckets:**
  - `verification-docs` — Student ID cards, degree certificates (private, pre-signed URLs)
  - `avatars` — User profile photos (public CDN)
  - `university-images` — University logos and photos (public CDN)
  - `message-media` — Chat images/files (private, pre-signed URLs, 90-day retention)
- **Access:** service-role key (server-side only — never exposed to clients)

## Backend Hosting: Render

- Auto-deploy from GitHub (`develop` → staging, `main` → production)
- Environment variables managed in Render dashboard
- **Dashboard:** [dashboard.render.com](https://dashboard.render.com)

## Mobile: Expo + EAS Build

- **Development:** Expo Go (metro bundler on localhost)
- **Preview:** EAS Build (preview profile) — internal distribution
- **Production:** EAS Build (production profile) → App Store / Play Store
- **Dashboard:** [expo.dev](https://expo.dev)

## Infrastructure Ownership

All cloud resources are owned and managed by **Kiran Raj**.  
Developers consume services via environment variables only.  
For credentials, contact the infrastructure owner.
