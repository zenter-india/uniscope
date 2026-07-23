import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// prisma.config.ts is read by the Prisma CLI only (migrate, generate, etc.).
// The NestJS runtime connects via DATABASE_URL directly.
//
// For Supabase with pgBouncer:
//   - DATABASE_URL  → transaction pooler (port 6543) — used at runtime
//   - DIRECT_URL    → direct connection (port 5432)  — used by Prisma CLI for migrations
//
// When DIRECT_URL is set, the CLI uses it to bypass pgBouncer (required for schema migrations).
// When only DATABASE_URL is set (local dev / first-time setup), the CLI falls back to it.
//
// Falls back to a placeholder instead of throwing when neither is set: `prisma generate`
// only reads the schema file and never needs a live connection, but some hosts (Railway's
// Nixpacks build in particular) don't forward service env vars into the Docker build stage
// at all — only into the running container at start. `migrate deploy` (which does need a
// real connection) always runs at container start, by which point the real value is present.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'] ?? 'postgresql://placeholder',
  },
});
