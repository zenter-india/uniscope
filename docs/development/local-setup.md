# Local development setup

## Prerequisites

Install the following:

- **Node.js** 20 LTS or newer
- **npm** 10+
- **PostgreSQL** 15+ (or Docker — see below)
- **Git**
- **Expo Go** (physical device) or Xcode / Android Studio (simulators)

Optional:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) for local PostgreSQL

## 1. Clone and install

```bash
git clone <repository-url> medconnect
cd medconnect
npm install
```

This installs dependencies for all workspaces (`mobile`, `backend`, `admin`).

## 2. Environment files

```bash
cp backend/.env.example backend/.env
cp admin/.env.example admin/.env.local
cp mobile/.env.example mobile/.env
```

Edit `backend/.env` if your PostgreSQL credentials differ.

## 3. Start PostgreSQL

### Option A — Docker Compose

```bash
cd infrastructure/docker
docker compose up -d
```

Default connection (matches `backend/.env.example`):

```
postgresql://medconnect:medconnect@localhost:5432/medconnect_dev
```

### Option B — Local PostgreSQL

Create database and user:

```sql
CREATE USER medconnect WITH PASSWORD 'medconnect';
CREATE DATABASE medconnect_dev OWNER medconnect;
```

## 4. Prisma setup

```bash
npm run prisma:generate --workspace=backend
```

When business models exist:

```bash
npm run prisma:migrate:dev --workspace=backend
```

## 5. Run applications

Use separate terminals:

```bash
# API — http://localhost:3001
npm run dev:backend

# Admin — http://localhost:3000
npm run dev:admin

# Mobile — Expo dev server
npm run dev:mobile
```

Verify API health: `curl http://localhost:3001/health`

## 6. Mobile device notes

- iOS Simulator: press `i` in Expo CLI
- Android emulator: press `a`
- Physical device: scan QR with Expo Go; ensure phone and machine share a network

For local API access from a device, use your machine's LAN IP in `EXPO_PUBLIC_API_URL`.

## Troubleshooting

| Issue | Fix |
| ----- | --- |
| `DATABASE_URL` errors | Confirm Postgres is running and `.env` is correct |
| Port in use | Change `PORT` in `backend/.env` |
| Expo can't reach API | Use LAN IP, not `localhost`, on physical devices |
| Prisma client missing | Run `npm run prisma:generate --workspace=backend` |

## Disk space

`node_modules` across three packages is large. Run `npm install` only at repo root. Do not commit `node_modules`.
