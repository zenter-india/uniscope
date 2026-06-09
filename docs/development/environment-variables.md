# Environment variable strategy

## Principles

1. **Never commit secrets** — `.env` files are gitignored; commit `.env.example` only.
2. **Per-app configuration** — each package owns its env files.
3. **Public vs private** — only expose client-safe values via framework public prefixes.
4. **Single source for backend secrets** — `backend/.env` holds `DATABASE_URL` and server keys.

## File locations

| Package | Local file | Committed template |
| ------- | ---------- | ------------------ |
| backend | `.env` | `.env.example` |
| admin | `.env.local` | `.env.example` |
| mobile | `.env` | `.env.example` |

Next.js loads `.env.local` automatically in development.

## Variable reference

### Backend (`backend/.env`)

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `NODE_ENV` | No | `development` \| `production` \| `test` |
| `PORT` | No | HTTP port (default `3001`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |

### Admin (`admin/.env.local`)

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `NEXT_PUBLIC_API_URL` | No | Backend base URL for browser |

### Mobile (`mobile/.env`)

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `EXPO_PUBLIC_API_URL` | No | Backend base URL for app |

## Environments

| Environment | Backend | Admin | Mobile |
| ----------- | ------- | ----- | ------ |
| Local | `.env` | `.env.local` | `.env` |
| Staging | Platform secrets | Vercel/host env | EAS secrets |
| Production | Platform secrets | Vercel/host env | EAS secrets |

## Future variables (reserved)

Document here as they are introduced:

- `JWT_SECRET` / auth provider keys (backend only)
- `SENTRY_DSN` (per app)
- `REDIS_URL` (backend)
- Object storage credentials (backend)

## CI/CD

- Inject secrets via GitHub Actions secrets or deployment platform.
- Never log env values in CI output.
- Validate required vars at application startup (backend config module).

## Adding a new variable

1. Add to the appropriate `.env.example` with a safe placeholder.
2. Document in this file.
3. Mention in PR description.
4. Configure in staging/production secret stores before deploy.
