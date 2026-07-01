# Uniscope — Environment Variables Reference

All environment variables for the backend service. Copy `backend/.env.example` → `backend/.env` and fill in values.

| Variable | Required | Default | Purpose | Where to get it |
|----------|----------|---------|---------|-----------------|
| **App** | | | | |
| `NODE_ENV` | No | `development` | Runtime environment | Set manually |
| `PORT` | No | `3000` | HTTP server port | Set manually |
| `APP_NAME` | No | `Uniscope API` | Application name (logging) | Set manually |
| `API_PREFIX` | No | `api/v1` | URL prefix for all routes | Set manually |
| **Database** | | | | |
| `DATABASE_URL` | Yes | — | Supabase pooler connection string (pgBouncer, port 6543) | Supabase Dashboard → Settings → Database → Connection string (Transaction pooler) |
| `DIRECT_URL` | Yes (migrations) | — | Direct Supabase connection (port 5432, no pooler) | Supabase Dashboard → Settings → Database → Connection string (Direct connection) |
| **Supabase** | | | | |
| `SUPABASE_URL` | Yes | — | Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Yes | — | Supabase anon/public JWT key | Supabase Dashboard → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Supabase service role JWT key (server-side only, never expose to clients) | Supabase Dashboard → Settings → API → service_role key |
| **Firebase** | | | | |
| `FIREBASE_PROJECT_ID` | Yes | `uniscope-local` | Firebase project ID for FCM | Firebase Console → Project settings |
| `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` | Yes | `./firebase-service-account.json` | Path to Firebase service account JSON file | Firebase Console → Project settings → Service accounts → Generate new private key |
| `FIREBASE_DISABLED` | No | `false` | Set `true` to disable FCM (useful in local dev without credentials) | Set manually |
| **JWT** | | | | |
| `JWT_ACCESS_SECRET` | Yes | — | Secret for signing access tokens (min 16 chars) | Generate: `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Yes | — | Secret for signing refresh tokens (min 16 chars) | Generate: `openssl rand -base64 32` |
| `JWT_ACCESS_TTL` | No | `900` | Access token TTL in seconds (15 min) | Set manually |
| `JWT_REFRESH_TTL` | No | `604800` | Refresh token TTL in seconds (7 days) | Set manually |
| **Redis (Upstash)** | | | | |
| `REDIS_URL` | Yes (cloud) | — | Upstash Redis TLS URL (`rediss://:[password]@[endpoint].upstash.io:6379`). Takes priority over `REDIS_HOST` when set. | Upstash Console → Redis → Connect → ioredis |
| `REDIS_HOST` | No | `localhost` | Redis hostname (legacy local dev, ignored when `REDIS_URL` is set) | Set manually |
| `REDIS_PORT` | No | `6379` | Redis port (legacy local dev) | Set manually |
| `REDIS_PASSWORD` | No | `` | Redis password (legacy local dev) | Set manually |
| `REDIS_OTP_TTL` | No | `600` | OTP expiry in seconds (10 min) | Set manually |
| **OTP / Twilio** | | | | |
| `OTP_PROVIDER_TYPE` | No | `mock` | OTP provider: `twilio` (production) or `mock` (local dev with Redis) | Set manually |
| `TWILIO_ACCOUNT_SID` | When `OTP_PROVIDER_TYPE=twilio` | — | Twilio Account SID (`ACxxxxxxxxxx`) | Twilio Console → Account Info |
| `TWILIO_AUTH_TOKEN` | When `OTP_PROVIDER_TYPE=twilio` | — | Twilio Auth Token | Twilio Console → Account Info |
| `TWILIO_VERIFY_SERVICE_SID` | When `OTP_PROVIDER_TYPE=twilio` | — | Twilio Verify Service SID (`VAxxxxxxxxxx`) | Twilio Console → Verify → Services → [Service] |

## Environment Matrix

| Variable | Local Dev | Staging | Production |
|----------|-----------|---------|------------|
| `NODE_ENV` | `development` | `development` | `production` |
| `DATABASE_URL` | Supabase dev pooler | Supabase qa pooler | Supabase prod pooler |
| `DIRECT_URL` | Supabase dev direct | Supabase qa direct | Supabase prod direct |
| `REDIS_URL` | Upstash (shared dev) | Upstash (qa instance) | Upstash (prod instance) |
| `OTP_PROVIDER_TYPE` | `mock` | `twilio` | `twilio` |
| `FIREBASE_DISABLED` | `true` | `false` | `false` |

## Security Notes

- **Never commit `.env` to version control.** `.env` is in `.gitignore`.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row-Level Security — treat as a secret equal to a database root password.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be different and cryptographically random.
- Rotate all secrets immediately if accidentally exposed.
