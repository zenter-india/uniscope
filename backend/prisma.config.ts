import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// prisma.config.ts is read by the Prisma CLI only (migrate, generate, etc.).
// The NestJS runtime connects via DATABASE_URL directly.
//
// For Supabase with pgBouncer:
//   - DATABASE_URL  → transaction pooler (port 6543) — used at runtime
//   - DIRECT_URL    → direct connection (port 5432)  — used by Prisma CLI for migrations
//
// When DIRECT_URL is set, the CLI uses it to bypass pgBouncer (required for schema migrations).
// When only DATABASE_URL is set (local dev / first-time setup), the CLI falls back to it.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ? env('DIRECT_URL') : env('DATABASE_URL'),
  },
});
