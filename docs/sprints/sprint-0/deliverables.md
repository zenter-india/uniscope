# Sprint 0 deliverables

## Repository

```
medconnect/
├── mobile/                 # Expo (TypeScript) placeholder
├── backend/                # NestJS + Prisma placeholder
├── admin/                  # Next.js placeholder
├── docs/                   # Full documentation tree
├── infrastructure/         # Docker, deployment placeholders
├── .github/                # PR + issue templates
├── README.md
├── CONTRIBUTING.md
└── package.json            # npm workspaces root
```

## Applications

| App | Entry | Notes |
| --- | ----- | ----- |
| Mobile | `mobile/App.tsx` | Home screen placeholder |
| Backend | `backend/src/main.ts` | Health at `/health` |
| Admin | `admin/app/page.tsx` | Landing placeholder |

## Documentation

- Product, architecture, database, API folders
- Coding standards and naming conventions
- Branch strategy and local setup
- Environment variable strategy
- ADR structure with 0001 and 0002

## Verification

```bash
npm install
cp backend/.env.example backend/.env
docker compose -f infrastructure/docker/docker-compose.yml up -d
npm run prisma:generate --workspace=backend
npm run dev:backend
curl http://localhost:3001/health
```
