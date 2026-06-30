# MedConnect API

NestJS backend for MedConnect. Sprint 0 provides infrastructure only — no business APIs.

## Scripts

```bash
npm run start:dev          # Development server (port 3001)
npm run build              # Compile
npm run test               # Unit tests
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate:dev # Create/apply migrations
npm run prisma:studio      # Database GUI
```

## Structure

```
src/
├── common/          # Shared decorators, guards, filters, pipes
├── config/          # Configuration
├── database/prisma/ # PrismaModule + PrismaService
├── health/          # GET /health
├── modules/         # Feature modules (future)
├── app.module.ts
└── main.ts
```

## Environment

Copy `.env.example` to `.env` and set `DATABASE_URL`.

See [local setup](../../docs/development/local-setup.md).
